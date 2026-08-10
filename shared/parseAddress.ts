/**
 * V2.1.22: Parse a legacy single-line Malaysian address into structured fields.
 * Used when a customer record only has the old `address` field populated
 * and the structured fields (addressLine1, addressLine2, city, state, postcode) are NULL.
 *
 * Examples:
 *   "11.Lorong Kebudayaan Desa Lawan Kuda, Gopeng, Perak, 31600, Malaysia"
 *   → { addressLine1: "11.Lorong Kebudayaan Desa Lawan Kuda", addressLine2: "", city: "Gopeng", state: "Perak", postcode: "31600", country: "Malaysia" }
 *
 *   "851 Jalan Menglembu Utara 1, 851 Jalan Menglembu Utara 1 Menglembu Ipoh, Perak, 31450, Malaysia"
 *   → { addressLine1: "851 Jalan Menglembu Utara 1, 851 Jalan Menglembu Utara 1 Menglembu", addressLine2: "", city: "Ipoh", state: "Perak", postcode: "31450", country: "Malaysia" }
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

  // Step 4: Extract city using known Malaysian cities list
  // Common Malaysian cities, towns, and areas
  const malaysianCities = [
    // Major cities
    "Ipoh", "Johor Bahru", "Kuala Lumpur", "Georgetown", "Kuching", "Kota Kinabalu",
    "Shah Alam", "Petaling Jaya", "Subang Jaya", "Klang", "Cheras", "Ampang",
    "Kajang", "Serdang", "Puchong", "Damansara", "Seremban", "Malacca",
    "Alor Setar", "Kota Bharu", "Kuala Terengganu", "Kuantan", "Kangar",
    "Miri", "Sibu", "Sandakan", "Tawau", "Labuan",
    // Selangor areas
    "Shah Alam", "Petaling Jaya", "Subang Jaya", "Klang", "Cheras", "Ampang",
    "Kajang", "Serdang", "Puchong", "Damansara", "Gombak", "Hulu Langat",
    "Sepang", "Kuala Selangor", "Sabak Bernam", "Kuala Langat",
    // Penang areas
    "Butterworth", "Bukit Mertajam", "Bayan Lepas", "Gelugor", "Balik Pulau",
    // Perak areas
    "Menglembu", "Gopeng", "Tapah", "Kampar", "Teluk Intan", "Lumut", "Sitiawan",
    "Taiping", "Kuala Kangsar", "Parit Buntar", "Sungai Siput",
    // Johor areas
    "Muar", "Batu Pahat", "Kluang", "Segamat", "Kulai", "Pasir Gudang",
    "Iskandar Puteri", "Skudai", "Pontian", "Kota Tinggi", "Mersing",
    // Negeri Sembilan areas
    "Mantin", "Port Dickson", "Nilai", "Bahau", "Kuala Pilah", "Jempol",
    // Sabah areas
    "Tawau", "Lahad Datu", "Keningau", "Sandakan", "Kudat", "Putatan",
    // Sarawak areas
    "Miri", "Sibu", "Bintulu", "Limbang", "Sarikei", "Kapit",
    // Kedah areas
    "Sungai Petani", "Kulim", "Baling", "Yan", "Sik", "Padang Terap",
    // Pahang areas
    "Bentong", "Raub", "Temerloh", "Pekan", "Rompin", "Jerantut", "Cameron Highlands",
    // Kelantan areas
    "Pasir Mas", "Kota Bharu", "Tumpat", "Pasir Puteh", "Bachok", "Tanah Merah",
    // Terengganu areas
    "Kemaman", "Dungun", "Marang", "Besut", "Setiu", "Hulu Terengganu",
    // Melaka areas
    "Alor Gajah", "Jasin", "Masjid Tanah", "Merlimau",
    // Others
    "Putrajaya", "Cyberjaya", "Bandar Baru Bangi", "Bangi",
  ];

  // Try to find a known city in the remaining address text
  for (const city of malaysianCities) {
    const cityRegex = new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (cityRegex.test(address)) {
      result.city = city;
      address = address.replace(cityRegex, "").replace(/[,，]/g, " ").replace(/\s+/g, " ").trim();
      break;
    }
  }

  // Step 5: Split remaining address into addressLine1 and addressLine2
  const segments = address.split(/[,，]/).map(s => s.trim()).filter(Boolean);

  if (segments.length === 0) {
    return result;
  }

  if (segments.length === 1) {
    result.addressLine1 = segments[0];
  } else {
    // Multiple segments: first segment is addressLine1, rest joined as addressLine2
    result.addressLine1 = segments[0];
    result.addressLine2 = segments.slice(1).join(", ");
  }

  // Step 6: If we still don't have a city, try to extract from the original address
  // Look at the segment just before the state in the original address
  if (!result.city && result.state) {
    const originalSegments = rawAddress.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    const stateIdx = originalSegments.findIndex(s =>
      s.toLowerCase().includes(result.state.toLowerCase())
    );
    if (stateIdx > 0) {
      const citySegment = originalSegments[stateIdx - 1];
      // The city is typically the last word(s) in this segment
      // Try to extract alphabetic-only words from the end
      const words = citySegment.split(/\s+/);
      const cityWords: string[] = [];
      for (let i = words.length - 1; i >= 0; i--) {
        if (/^[A-Za-z]+$/.test(words[i]) && words[i].length > 2) {
          cityWords.unshift(words[i]);
        } else {
          break;
        }
      }
      if (cityWords.length > 0) {
        result.city = cityWords.join(" ");
      }
    }
  }

  // Step 7: If we still don't have a city but have postcode, try to find city
  // by looking at what was between postcode and state in original address
  if (!result.city && result.postcode) {
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

  // Step 8: Clean up addressLine1 — remove trailing commas/spaces
  result.addressLine1 = result.addressLine1.replace(/[,，\s]+$/, "").trim();
  if (result.addressLine2) {
    result.addressLine2 = result.addressLine2.replace(/[,，\s]+$/, "").trim();
  }

  return result;
}
