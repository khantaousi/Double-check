import { DataRow, ValidationRule, ProductPrice, GiftRule, SiteSettings } from '../types';
import { extractPrices, evaluateCustomAmountRules } from './gemini';

export function parseSpecialDiscount(instruction: string, total: number): number {
  if (!instruction) return 0;
  
  const lower = instruction.toLowerCase();
  
  // 1. Percentage check: "10%"
  const pcMatch = lower.match(/(\d+)\s*%/);
  if (pcMatch) {
    return (total * parseInt(pcMatch[1], 10)) / 100;
  }
  
  // 2. Fixed value check: "100/-", "100tk", "100 discount", "100 off"
  const fixedMatch = lower.match(/(\d+)\s*(?:\/|-|tk|discount|off|taka)/);
  if (fixedMatch) {
    return parseInt(fixedMatch[1], 10);
  }

  // 3. Simple fallback: if number exists with keywords
  const simpleMatch = lower.match(/(\d+)/);
  if (simpleMatch && (lower.includes('discount') || lower.includes('off') || lower.includes('-') || lower.includes('gift'))) {
    const val = parseInt(simpleMatch[1], 10);
    // Safety: ignore numbers that are too large (likely phone numbers or years)
    if (val < total && val > 0 && simpleMatch[1].length <= 4) {
      return val;
    }
  }
  
  return 0;
}

export function calculateRow(
  row: DataRow, 
  rules: ValidationRule[],
  delivery: { insideDhaka: number; outsideDhaka: number } = { insideDhaka: 80, outsideDhaka: 140 },
  tolerance: number = 5
): DataRow {
  // If ItemQuantity is > 1 but description has multiple items, findPriceInLibrary already correctly sums them.
  // We avoid * row.ItemQuantity here because multi-product descriptions usually specify quantities internally.
  const baseTotal = (row.extractedBasePrice || 0);
  const target = row.AmountToCollect;
  const specialDisc = parseSpecialDiscount(row.SpecialInstruction, baseTotal);

  const isDhaka = row.RecipientCity.toLowerCase().includes('dhaka');
  const dCharge = isDhaka ? delivery.insideDhaka : delivery.outsideDhaka;

  const instr = row.SpecialInstruction.toLowerCase();
  const isDeliveryFree = instr.includes('delivery free') || instr.includes('delivary free') || instr.includes('charge free') || instr.includes('del free');

  // Helper to find tiered discount
  const getTiered = (amount: number) => {
    const rule = rules.find(r => amount >= r.min && amount <= r.max);
    return rule ? { percentage: rule.percentage, amount: (amount * rule.percentage) / 100 } : null;
  };

  // Possible scenarios to check
  const scenarios: { total: number; notes: string[] }[] = [];

  // Variations of (Base, Special, Tiered, Special+Tiered)
  const variants = [
    { name: 'Base', val: baseTotal, notes: [] },
    { 
      name: 'Special', 
      val: baseTotal - specialDisc, 
      notes: specialDisc > 0 ? [`Special discount: ${specialDisc}`] : [] 
    },
    { 
      name: 'Tiered', 
      val: baseTotal - (getTiered(baseTotal)?.amount || 0), 
      notes: getTiered(baseTotal) ? [`Tiered discount (${getTiered(baseTotal)!.percentage}%): ${getTiered(baseTotal)!.amount.toFixed(2)}`] : [] 
    },
    { 
      name: 'Both', 
      val: (baseTotal - specialDisc) - (getTiered(baseTotal - specialDisc)?.amount || 0), 
      notes: [
        ...(specialDisc > 0 ? [`Special discount: ${specialDisc}`] : []),
        ...(getTiered(baseTotal - specialDisc) ? [`Tiered discount (${getTiered(baseTotal - specialDisc)!.percentage}%): ${getTiered(baseTotal - specialDisc)!.amount.toFixed(2)}`] : [])
      ]
    }
  ];

  variants.forEach(v => {
    // 1. Without Delivery (Either because it's free or explicitly excluded)
    scenarios.push({ total: v.val, notes: v.notes });

    // 2. With Delivery
    scenarios.push({ 
      total: v.val + dCharge, 
      notes: [...v.notes, `Delivery charge (${isDhaka ? 'Dhaka' : 'Outside Dhaka'}): ${dCharge}`] 
    });
  });

  // Find best match (within tolerance units)
  let bestMatch = scenarios.find(s => Math.abs(s.total - target) <= tolerance);

  if (bestMatch || row.isPermitted) {
    row.calculatedTotal = Math.round(bestMatch ? bestMatch.total : target);
    row.isMismatch = false;
    row.notes = [...(row.notes || []), ...(bestMatch ? bestMatch.notes : ["Permitted by Leader"])];
  } else {
    const defaultScenario = scenarios[scenarios.length - 1];
    row.calculatedTotal = Math.round(defaultScenario.total);
    row.isMismatch = true;
    row.notes = [...(row.notes || []), ...defaultScenario.notes, `Mismatch: Expected ${row.calculatedTotal}, Got ${target}`];
  }

  return row;
}

function findPriceInLibrary(
  desc: string, 
  specialInstruction: string, 
  library: ProductPrice[], 
  giftRules: GiftRule[],
  rowQuantity: number = 1
): { total: number; isWholesale: boolean; details: string[] } | null {
  if (!desc) return null;
  const lowerDesc = desc.toLowerCase();
  const lowerInstr = (specialInstruction || '').toLowerCase();
  
  const sortedLib = [...library].sort((a, b) => b.name.length - a.name.length);
  let total = 0;
  let foundAny = false;
  let isWholesaleApplied = false;
  let workingDesc = lowerDesc;
  const details: string[] = [];

  // Dynamic Gift Logic
  const activeGifts = giftRules.filter(rule => 
    rule.isActive && 
    rule.triggerKeywords.some(keyword => lowerInstr.includes(keyword.toLowerCase()))
  );

  const foundMatches: { product: ProductPrice; qty: number; matchText: string; matchIdx: number }[] = [];

  for (const p of sortedLib) {
    const pName = p.name.toLowerCase();
    if (!pName) continue;

    const flexibleName = pName
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '[\\s\\-_]*');
    const regex = new RegExp(`(\\d+)?\\s*${flexibleName}`, 'gi');
    
    let match;
    const searchString = workingDesc;
    while ((match = regex.exec(searchString)) !== null) {
      const matchText = match[0];
      const matchIdx = match.index;
      
      const currentSection = workingDesc.substring(matchIdx, matchIdx + matchText.length);
      if (currentSection.trim() === '') continue;

      const qty = match[1] ? parseInt(match[1], 10) : 1;
      foundMatches.push({ product: p, qty, matchText, matchIdx });
      
      workingDesc = workingDesc.substring(0, matchIdx) + ' '.repeat(matchText.length) + workingDesc.substring(matchIdx + matchText.length);
    }
  }

  // Fallback: If only one product type found and total qty < rowQuantity, scale up
  if (foundMatches.length === 1 && foundMatches[0].qty < rowQuantity) {
    foundMatches[0].qty = rowQuantity;
  }

  for (const m of foundMatches) {
    const p = m.product;
    const qty = m.qty;
    let effectivePrice = p.price;
    let wholesaleForThis = false;

    if (p.wholesalePrice && p.wholesaleThreshold && qty >= p.wholesaleThreshold) {
      effectivePrice = p.wholesalePrice;
      wholesaleForThis = true;
      isWholesaleApplied = true;
    }
    
    const appliedGift = activeGifts.find(rule => 
      rule.targetKeywords.some(tk => {
        const lowerTk = tk.toLowerCase();
        return p.name.toLowerCase().includes(lowerTk) || p.name.toLowerCase() === lowerTk;
      })
    );

    if (appliedGift) {
      effectivePrice = 0;
      details.push(`${qty}x ${p.name} (GIFT - 0tk)`);
    } else {
      total += effectivePrice * qty;
      details.push(`${qty}x ${p.name} @ ${effectivePrice}tk${wholesaleForThis ? ' (Wholesale)' : ''}`);
    }
    foundAny = true;
  }
  
  return foundAny ? { total, isWholesale: isWholesaleApplied, details } : null;
}

export async function processData(
  rawRows: any[], 
  rules: ValidationRule[],
  productLibrary: ProductPrice[],
  giftRules: GiftRule[],
  delivery: { insideDhaka: number; outsideDhaka: number },
  siteSettings: SiteSettings,
  onProgress?: (p: number) => void
): Promise<DataRow[]> {
  const libraryResults: ({ total: number; isWholesale: boolean; details: string[] } | null)[] = new Array(rawRows.length).fill(null);
  const extractedPrices: number[] = new Array(rawRows.length).fill(0);
  const needsAISearch: { desc: string; instr: string; originalIdx: number }[] = [];

  rawRows.forEach((raw, idx) => {
    const desc = String(raw.ItemDesc || '');
    const instr = String(raw.SpecialInstruction || '');
    const qty = Number(raw.ItemQuantity || 1);
    const libResult = findPriceInLibrary(desc, instr, productLibrary, giftRules, qty);
    
    if (libResult !== null) {
      libraryResults[idx] = libResult;
      extractedPrices[idx] = libResult.total;
    } else {
      needsAISearch.push({ desc, instr, originalIdx: idx });
    }
  });

  if (needsAISearch.length > 0) {
    const batchSize = 10;
    for (let i = 0; i < needsAISearch.length; i += batchSize) {
      const batch = needsAISearch.slice(i, i + batchSize);
      const results = await extractPrices(batch.map(b => b.desc));
      results.forEach((price, batchIdx) => {
        // AI extracted price - we might want to check for gifts here too if AI can't handle it
        // but for now, we assume AI extracts what's intended.
        // If the user wants robust gift logic even for AI-extracted items, 
        // we'd need to subtract the GIFT items from the AI result.
        // However, findPriceInLibrary is the primary way.
        extractedPrices[batch[batchIdx].originalIdx] = price;
      });
      if (onProgress) onProgress(((i + batchSize) / needsAISearch.length) * 100);
    }
  } else if (onProgress) {
    onProgress(100);
  }

  const phoneCounts = new Map<string, number>();
  rawRows.forEach(r => {
    const phone = String(r['RecipientPhone(*)'] || '');
    phoneCounts.set(phone, (phoneCounts.get(phone) || 0) + 1);
  });

  const processed = rawRows.map((raw, idx) => {
    const instr = String(raw.SpecialInstruction || '').toLowerCase();
    const isPermitted = (siteSettings.permissionKeywords || []).some(kw => 
      instr.includes(kw.toLowerCase())
    );

    const row: DataRow = {
      id: crypto.randomUUID(),
      InvoiceNo: String(raw['InvoiceNo(*)'] || raw.InvoiceNo || ''),
      ItemType: String(raw.ItemType || ''),
      StoreName: String(raw.StoreName || ''),
      MerchantOrderId: String(raw.MerchantOrderId || ''),
      RecipientName: String(raw['RecipientName(*)'] || ''),
      RecipientPhone: String(raw['RecipientPhone(*)'] || ''),
      RecipientAddress: String(raw['RecipientAddress(*)'] || ''),
      RecipientCity: String(raw['RecipientCity(*)'] || ''),
      RecipientZone: String(raw['RecipientZone(*)'] || ''),
      RecipientArea: String(raw.RecipientArea || ''),
      AmountToCollect: Number(raw['AmountToCollect(*)'] || 0),
      ItemQuantity: Number(raw.ItemQuantity || 1),
      ItemWeight: String(raw.ItemWeight || ''),
      ItemDesc: String(raw.ItemDesc || ''),
      SpecialInstruction: String(raw.SpecialInstruction || ''),
      extractedBasePrice: extractedPrices[idx] || 0,
      isWholesale: libraryResults[idx]?.isWholesale || false,
      isPermitted,
      notes: libraryResults[idx]?.details || []
    };

    // Duplicate Check
    if (phoneCounts.get(row.RecipientPhone) && phoneCounts.get(row.RecipientPhone)! > 1) {
      row.isDuplicate = true;
      row.notes?.push(`Duplicate RecipientPhone detected`);
    }

    // Default calculation
    return calculateRow(row, rules, delivery, siteSettings.amountTolerance);
  });

  // Check if we need to apply a custom AI rule for amount evaluation
  if (siteSettings.customAmountRule && siteSettings.customAmountRule.trim() !== '') {
    const batchSize = 10;
    for (let i = 0; i < processed.length; i += batchSize) {
      const batch = processed.slice(i, i + batchSize);
      try {
        const evalResults = await evaluateCustomAmountRules(batch, siteSettings.customAmountRule, !!siteSettings.combineBaseRulesWithAI);
        
        evalResults.forEach((evalResult, idx) => {
          const rowIdx = i + idx;
          if (processed[rowIdx].isPermitted) {
             // Let permitted items stay valid
             processed[rowIdx].isMismatch = false;
             processed[rowIdx].notes = [...(processed[rowIdx].notes || []), "Permitted (Overrides Custom Rule)"];
          } else {
             processed[rowIdx].calculatedTotal = evalResult.calculatedTotal;
             processed[rowIdx].isMismatch = evalResult.isMismatch;
             processed[rowIdx].notes = [...(processed[rowIdx].notes || []), ...evalResult.notes];
          }
        });
      } catch (err) {
        console.error("Batch custom rule evaluation failed:", err);
      }
      if (onProgress) onProgress(((i + batch.length) / processed.length) * 100);
    }
  }

  // Sorting: Mismatched (Red) rows at the bottom
  return processed.sort((a, b) => {
    const aFlag = a.isMismatch || a.isDuplicate ? 1 : 0;
    const bFlag = b.isMismatch || b.isDuplicate ? 1 : 0;
    return aFlag - bFlag;
  });
}
