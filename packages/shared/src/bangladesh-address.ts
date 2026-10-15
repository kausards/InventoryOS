export interface BangladeshDivision {
  id: string;
  name: string;
  bnName: string;
}

export interface BangladeshDistrict {
  id: string;
  divisionId: string;
  name: string;
  bnName: string;
}

export const BANGLADESH_DIVISIONS: BangladeshDivision[] = [
  { id: 'dhaka', name: 'Dhaka', bnName: 'ঢাকা' },
  { id: 'chattogram', name: 'Chattogram', bnName: 'চট্টগ্রাম' },
  { id: 'rajshahi', name: 'Rajshahi', bnName: 'রাজশাহী' },
  { id: 'khulna', name: 'Khulna', bnName: 'খুলনা' },
  { id: 'barishal', name: 'Barishal', bnName: 'বরিশাল' },
  { id: 'sylhet', name: 'Sylhet', bnName: 'সিলেট' },
  { id: 'rangpur', name: 'Rangpur', bnName: 'রংপুর' },
  { id: 'mymensingh', name: 'Mymensingh', bnName: 'ময়মনসিংহ' },
];

export const BANGLADESH_DISTRICTS: BangladeshDistrict[] = [
  // Dhaka Division (13 districts)
  { id: 'dhaka', divisionId: 'dhaka', name: 'Dhaka', bnName: 'ঢাকা' },
  { id: 'gazipur', divisionId: 'dhaka', name: 'Gazipur', bnName: 'গাজীপুর' },
  { id: 'narayanganj', divisionId: 'dhaka', name: 'Narayanganj', bnName: 'নারায়ণগঞ্জ' },
  { id: 'tangail', divisionId: 'dhaka', name: 'Tangail', bnName: 'টাঙ্গাইল' },
  { id: 'kishoreganj', divisionId: 'dhaka', name: 'Kishoreganj', bnName: 'কিশোরগঞ্জ' },
  { id: 'manikganj', divisionId: 'dhaka', name: 'Manikganj', bnName: 'মানিকগঞ্জ' },
  { id: 'munshiganj', divisionId: 'dhaka', name: 'Munshiganj', bnName: 'মুন্সীগঞ্জ' },
  { id: 'narsingdi', divisionId: 'dhaka', name: 'Narsingdi', bnName: 'নরসিংদী' },
  { id: 'faridpur', divisionId: 'dhaka', name: 'Faridpur', bnName: 'ফরিদপুর' },
  { id: 'gopalganj', divisionId: 'dhaka', name: 'Gopalganj', bnName: 'গোপালগঞ্জ' },
  { id: 'madaripur', divisionId: 'dhaka', name: 'Madaripur', bnName: 'মাদারীপুর' },
  { id: 'rajbari', divisionId: 'dhaka', name: 'Rajbari', bnName: 'রাজবাড়ী' },
  { id: 'shariatpur', divisionId: 'dhaka', name: 'Shariatpur', bnName: 'শরীয়তপুর' },

  // Chattogram Division (11 districts)
  { id: 'chattogram', divisionId: 'chattogram', name: 'Chattogram', bnName: 'চট্টগ্রাম' },
  { id: 'coxsbazar', divisionId: 'chattogram', name: "Cox's Bazar", bnName: 'কক্সবাজার' },
  { id: 'cumilla', divisionId: 'chattogram', name: 'Cumilla', bnName: 'কুমিল্লা' },
  { id: 'feni', divisionId: 'chattogram', name: 'Feni', bnName: 'ফেনী' },
  { id: 'brahmanbaria', divisionId: 'chattogram', name: 'Brahmanbaria', bnName: 'ব্রাহ্মণবাড়িয়া' },
  { id: 'chandpur', divisionId: 'chattogram', name: 'Chandpur', bnName: 'চাঁদপুর' },
  { id: 'lakshmipur', divisionId: 'chattogram', name: 'Lakshmipur', bnName: 'লক্ষ্মীপুর' },
  { id: 'noakhali', divisionId: 'chattogram', name: 'Noakhali', bnName: 'নোয়াখালী' },
  { id: 'khagrachhari', divisionId: 'chattogram', name: 'Khagrachhari', bnName: 'খাগড়াছড়ি' },
  { id: 'rangamati', divisionId: 'chattogram', name: 'Rangamati', bnName: 'রাঙ্গামাটি' },
  { id: 'bandarban', divisionId: 'chattogram', name: 'Bandarban', bnName: 'বান্দরবান' },

  // Rajshahi Division (8 districts)
  { id: 'rajshahi', divisionId: 'rajshahi', name: 'Rajshahi', bnName: 'রাজশাহী' },
  { id: 'bogura', divisionId: 'rajshahi', name: 'Bogura', bnName: 'বগুড়া' },
  { id: 'pabna', divisionId: 'rajshahi', name: 'Pabna', bnName: 'পাবনা' },
  { id: 'sirajganj', divisionId: 'rajshahi', name: 'Sirajganj', bnName: 'সিরাজগঞ্জ' },
  { id: 'naogaon', divisionId: 'rajshahi', name: 'Naogaon', bnName: 'নওগাঁ' },
  { id: 'natore', divisionId: 'rajshahi', name: 'Natore', bnName: 'নাটোর' },
  { id: 'chapai_nawabganj', divisionId: 'rajshahi', name: 'Chapai Nawabganj', bnName: 'চাঁপাইনবাবগঞ্জ' },
  { id: 'joypurhat', divisionId: 'rajshahi', name: 'Joypurhat', bnName: 'জয়পুরহাট' },

  // Khulna Division (10 districts)
  { id: 'khulna', divisionId: 'khulna', name: 'Khulna', bnName: 'খুলনা' },
  { id: 'jashore', divisionId: 'khulna', name: 'Jashore', bnName: 'যশোর' },
  { id: 'satkhira', divisionId: 'khulna', name: 'Satkhira', bnName: 'সাতক্ষীরা' },
  { id: 'bagerhat', divisionId: 'khulna', name: 'Bagerhat', bnName: 'বাগেরহাট' },
  { id: 'kushtia', divisionId: 'khulna', name: 'Kushtia', bnName: 'কুষ্টিয়া' },
  { id: 'jhenaidah', divisionId: 'khulna', name: 'Jhenaidah', bnName: 'ঝিনাইদহ' },
  { id: 'chuadanga', divisionId: 'khulna', name: 'Chuadanga', bnName: 'চুয়াডাঙ্গা' },
  { id: 'meherpur', divisionId: 'khulna', name: 'Meherpur', bnName: 'মেহেরপুর' },
  { id: 'narail', divisionId: 'khulna', name: 'Narail', bnName: 'নড়াইল' },
  { id: 'magura', divisionId: 'khulna', name: 'Magura', bnName: 'মাগুরা' },

  // Barishal Division (6 districts)
  { id: 'barishal', divisionId: 'barishal', name: 'Barishal', bnName: 'বরিশাল' },
  { id: 'patuakhali', divisionId: 'barishal', name: 'Patuakhali', bnName: 'পটুয়াখালী' },
  { id: 'bhola', divisionId: 'barishal', name: 'Bhola', bnName: 'ভোলা' },
  { id: 'pirojpur', divisionId: 'barishal', name: 'Pirojpur', bnName: 'পিরোজপুর' },
  { id: 'barguna', divisionId: 'barishal', name: 'Barguna', bnName: 'বরগুনা' },
  { id: 'jhalokathi', divisionId: 'barishal', name: 'Jhalokathi', bnName: 'ঝালকাঠি' },

  // Sylhet Division (4 districts)
  { id: 'sylhet', divisionId: 'sylhet', name: 'Sylhet', bnName: 'সিলেট' },
  { id: 'moulvibazar', divisionId: 'sylhet', name: 'Moulvibazar', bnName: 'মৌলভীবাজার' },
  { id: 'habiganj', divisionId: 'sylhet', name: 'Habiganj', bnName: 'হবিগঞ্জ' },
  { id: 'sunamganj', divisionId: 'sylhet', name: 'Sunamganj', bnName: 'সুনামগঞ্জ' },

  // Rangpur Division (8 districts)
  { id: 'rangpur', divisionId: 'rangpur', name: 'Rangpur', bnName: 'রংপুর' },
  { id: 'dinajpur', divisionId: 'rangpur', name: 'Dinajpur', bnName: 'দিনাজপুর' },
  { id: 'gaibandha', divisionId: 'rangpur', name: 'Gaibandha', bnName: 'গাইবান্ধা' },
  { id: 'kurigram', divisionId: 'rangpur', name: 'Kurigram', bnName: 'কুড়িগ্রাম' },
  { id: 'lalmonirhat', divisionId: 'rangpur', name: 'Lalmonirhat', bnName: 'লালমনিরহাট' },
  { id: 'nilphamari', divisionId: 'rangpur', name: 'Nilphamari', bnName: 'নীলফামারী' },
  { id: 'panchagarh', divisionId: 'rangpur', name: 'Panchagarh', bnName: 'পঞ্চগড়' },
  { id: 'thakurgaon', divisionId: 'rangpur', name: 'Thakurgaon', bnName: 'ঠাকুরগাঁও' },

  // Mymensingh Division (4 districts)
  { id: 'mymensingh', divisionId: 'mymensingh', name: 'Mymensingh', bnName: 'ময়মনসিংহ' },
  { id: 'jamalpur', divisionId: 'mymensingh', name: 'Jamalpur', bnName: 'জামালপুর' },
  { id: 'netrokona', divisionId: 'mymensingh', name: 'Netrokona', bnName: 'নেত্রকোণা' },
  { id: 'sherpur', divisionId: 'mymensingh', name: 'Sherpur', bnName: 'শেরপুর' },
];

export function getBangladeshDivisions(): BangladeshDivision[] {
  return BANGLADESH_DIVISIONS;
}

export function getDistrictsByDivision(divisionNameOrId: string): BangladeshDistrict[] {
  const normalized = divisionNameOrId.trim().toLowerCase();
  const division = BANGLADESH_DIVISIONS.find(
    (d) => d.id === normalized || d.name.toLowerCase() === normalized
  );
  if (!division) return [];
  return BANGLADESH_DISTRICTS.filter((d) => d.divisionId === division.id);
}

export function isValidBangladeshDistrict(districtName: string): boolean {
  const norm = districtName.trim().toLowerCase();
  return BANGLADESH_DISTRICTS.some((d) => d.name.toLowerCase() === norm || d.id === norm);
}
