/**
 * V2.1.22: Parse a legacy single-line Malaysian address into structured fields.
 * Used when a customer record only has the old `address` field populated
 * and the structured fields (addressLine1, addressLine2, city, state, postcode) are NULL.
 *
 * Examples:
 *   "11.Lorong Kebudayaan Desa Lawan Kuda, Gopeng, Perak, 31600, Malaysia"
 *   → { addressLine1: "11.Lorong Kebudayaan Desa Lawan Kuda", addressLine2: "", city: "Gopeng", state: "Perak", postcode: "31600", country: "Malaysia" }
 *
 *   "30 Jalan Pelangi lndah Taman Pelangi Indah, Mantin, Negeri Sembilan, 71700, Malaysia"
 *   → { addressLine1: "30 Jalan Pelangi lndah Taman Pelangi Indah", addressLine2: "", city: "Mantin", state: "Negeri Sembilan", postcode: "71700", country: "Malaysia" }
 */
export function parseLegacyAddress(rawAddress: string): {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
} {
  const result = {
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postcode: "",
    country: "",
  };

  if (!rawAddress || !rawAddress.trim()) return result;

  let address = rawAddress.trim();

  // Step 1: Extract country (Malaysia is common)
  const countryRegex = /\b(Malaysia|Singapores?|Brunei|Thailand|Indonesia)\b/i;
  const countryMatch = address.match(countryRegex);
  if (countryMatch) {
    result.country = countryMatch[1];
    address = address.replace(countryRegex, "").replace(/[,，]/g, " ").replace(/\s+/g, " ").trim();
  }

  // Step 2: Extract postcode (5 digits, Malaysian format)
  const postcodeRegex = /\b(\d{5})\b/;
  const postcodeMatch = address.match(postcodeRegex);
  if (postcodeMatch) {
    result.postcode = postcodeMatch[1];
    address = address.replace(postcodeRegex, "").replace(/[,，]/g, " ").replace(/\s+/g, " ").trim();
  }

  // Step 3: Extract Malaysian state
  const malaysianStates = [
    "Johor", "Kedah", "Kelantan", "Melaka", "Melacca", "Negeri Sembilan",
    "Pahang", "Penang", "Pulau Pinang", "Perak", "Perlis",
    "Sabah", "Sarawak", "Selangor", "Terengganu",
    "Kuala Lumpur", "Putrajaya", "Labuan",
    "WP Kuala Lumpur",
  ];

  const stateAliases: Record<string, string> = {
    "pulau pinang": "Penang",
    "penang": "Penang",
    "gelugor": "Penang",
    "georgetown": "Penang",
    "kuala lumpur": "Kuala Lumpur",
    "wp kuala lumpur": "Kuala Lumpur",
    "melacca": "Melaka",
    "federal territory of kuala lumpur": "Kuala Lumpur",
    "federal territory": "Kuala Lumpur",
  };

  let foundState: string | null = null;
  for (const s of malaysianStates) {
    const regex = new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(address)) {
      const aliasKey = Object.keys(stateAliases).find(k =>
        address.toLowerCase().includes(k.toLowerCase())
      );
      foundState = aliasKey ? stateAliases[aliasKey] : s;
      address = address.replace(regex, "").replace(/[,，]/g, " ").replace(/\s+/g, " ").trim();
      break;
    }
  }
  if (foundState) {
    result.state = foundState;
  }

  // Step 4: Extract city — the last meaningful segment after removing postcode, state, country
  // At this point, address contains street + city, separated by commas
  const segments = address.split(/[,，]/).map(s => s.trim()).filter(Boolean);

  if (segments.length === 0) {
    // Nothing left after extracting postcode/state/country
    return result;
  }

  if (segments.length === 1) {
    // Only one segment left — could be just street or just city
    // If we already have postcode and state, this is likely the street address
    if (result.postcode && result.state) {
      result.addressLine1 = segments[0];
    } else if (result.postcode && !result.state) {
      // Could be city or street — if it looks like a city name (short, no numbers), treat as city
      if (!/\d/.test(segments[0]) && segments[0].length < 30) {
        result.city = segments[0];
      } else {
        result.addressLine1 = segments[0];
      }
    } else {
      result.addressLine1 = segments[0];
    }
    return result;
  }

  // Multiple segments: last segment is usually city, rest is street address
  // But only if we don't already have a city
  const lastSeg = segments[segments.length - 1];
  const restSegs = segments.slice(0, -1);

  // If last segment looks like a city (no numbers, relatively short)
  if (!/\d/.test(lastSeg) && lastSeg.length < 40) {
    result.city = lastSeg;
    result.addressLine1 = restSegs.join(", ");
  } else {
    // Last segment has numbers or is long — treat all as address
    result.addressLine1 = segments.join(", ");
  }

  // If we still don't have a city but have postcode, try to find city
  // by looking at what was between postcode and state in original
  if (!result.city && result.postcode) {
    // Try to find text between postcode and state in original address
    const originalPostcodeIdx = rawAddress.indexOf(result.postcode);
    if (originalPostcodeIdx >= 0) {
      const afterPostcode = rawAddress.substring(originalPostcodeIdx + result.postcode.length);
      if (result.state) {
        const stateIdx = afterPostcode.toLowerCase().indexOf(result.state.toLowerCase());
        if (stateIdx > 0) {
          const cityCandidate = afterPostcode.substring(0, stateIdx).replace(/[,，]/g, "").trim();
          if (cityCandidate && !/\d/.test(cityCandidate)) {
            result.city = cityCandidate;
          }
        }
      }
    }
  }

  return result;
}
