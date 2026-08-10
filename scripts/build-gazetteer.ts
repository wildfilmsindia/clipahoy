/**
 * Generates data/gazetteer.json.
 *
 *   npx tsx scripts/build-gazetteer.ts
 *
 * Kept as a generator rather than a hand-edited JSON file because the entries
 * are regular and the file is long. Add rows here, re-run, commit the output.
 *
 * ACCURACY NOTE: coordinates are settlement centroids, accurate to roughly a
 * kilometre, which is all the app needs — lat/lng is stored for future
 * distance work but retrieval currently walks district/state/terrain by name.
 * `terrain` for a whole state is necessarily a simplification (Maharashtra has
 * coast and plateau both); it is only consulted on the last rung of the
 * fallback ladder, where "somewhere that looks similar" is the whole claim.
 * `district` for a city row is set to the city itself, which is right for
 * metros and approximate elsewhere — refine as real data demands.
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';

type Row = [name: string, district: string, state: string, region: string, terrain: string, lat: number, lng: number];

/** Non-India rows carry their country explicitly; India rows default to it. */
type WorldRow = [name: string, state: string, country: string, terrain: string, lat: number, lng: number];

const STATES: Row[] = [
  ['Jammu and Kashmir', 'Jammu and Kashmir', 'Jammu and Kashmir', 'North', 'hills', 33.7782, 76.5762],
  ['Ladakh', 'Ladakh', 'Ladakh', 'North', 'hills', 34.2268, 77.5619],
  ['Himachal Pradesh', 'Himachal Pradesh', 'Himachal Pradesh', 'North', 'hills', 31.1048, 77.1734],
  ['Punjab', 'Punjab', 'Punjab', 'North', 'dry plains', 31.1471, 75.3412],
  ['Haryana', 'Haryana', 'Haryana', 'North', 'dry plains', 29.0588, 76.0856],
  ['Uttarakhand', 'Uttarakhand', 'Uttarakhand', 'North', 'hills', 30.0668, 79.0193],
  ['Uttar Pradesh', 'Uttar Pradesh', 'Uttar Pradesh', 'North', 'dry plains', 26.8467, 80.9462],
  // Delhi is a UT, but for this archive it behaves as one city. "New Delhi"
  // aliases into it below — kept separate, they split ~7,500 clips in two and
  // a "Delhi" search missed half the Delhi footage.
  ['Delhi', 'Delhi', 'Delhi', 'North', 'dry plains', 28.6139, 77.209],
  ['Rajasthan', 'Rajasthan', 'Rajasthan', 'West', 'desert', 27.0238, 74.2179],
  ['Gujarat', 'Gujarat', 'Gujarat', 'West', 'coastal', 22.2587, 71.1924],
  ['Maharashtra', 'Maharashtra', 'Maharashtra', 'West', 'plateau', 19.7515, 75.7139],
  ['Goa', 'Goa', 'Goa', 'West', 'coastal', 15.2993, 74.124],
  ['Madhya Pradesh', 'Madhya Pradesh', 'Madhya Pradesh', 'Central', 'plateau', 22.9734, 78.6569],
  ['Chhattisgarh', 'Chhattisgarh', 'Chhattisgarh', 'Central', 'plateau', 21.2787, 81.8661],
  ['Bihar', 'Bihar', 'Bihar', 'East', 'river valley', 25.0961, 85.3131],
  ['Jharkhand', 'Jharkhand', 'Jharkhand', 'East', 'plateau', 23.6102, 85.2799],
  ['Odisha', 'Odisha', 'Odisha', 'East', 'coastal', 20.9517, 85.0985],
  ['West Bengal', 'West Bengal', 'West Bengal', 'East', 'delta', 22.9868, 87.855],
  ['Assam', 'Assam', 'Assam', 'Northeast', 'river valley', 26.2006, 92.9376],
  ['Arunachal Pradesh', 'Arunachal Pradesh', 'Arunachal Pradesh', 'Northeast', 'hills', 28.218, 94.7278],
  ['Manipur', 'Manipur', 'Manipur', 'Northeast', 'hills', 24.6637, 93.9063],
  ['Meghalaya', 'Meghalaya', 'Meghalaya', 'Northeast', 'hills', 25.467, 91.3662],
  ['Mizoram', 'Mizoram', 'Mizoram', 'Northeast', 'hills', 23.1645, 92.9376],
  ['Nagaland', 'Nagaland', 'Nagaland', 'Northeast', 'hills', 26.1584, 94.5624],
  ['Sikkim', 'Sikkim', 'Sikkim', 'Northeast', 'hills', 27.533, 88.5122],
  ['Tripura', 'Tripura', 'Tripura', 'Northeast', 'hills', 23.9408, 91.9882],
  ['Andhra Pradesh', 'Andhra Pradesh', 'Andhra Pradesh', 'South', 'coastal', 15.9129, 79.74],
  ['Telangana', 'Telangana', 'Telangana', 'South', 'plateau', 18.1124, 79.0193],
  ['Karnataka', 'Karnataka', 'Karnataka', 'South', 'plateau', 15.3173, 75.7139],
  ['Kerala', 'Kerala', 'Kerala', 'South', 'coastal', 10.8505, 76.2711],
  ['Tamil Nadu', 'Tamil Nadu', 'Tamil Nadu', 'South', 'coastal', 11.1271, 78.6569],
  ['Andaman and Nicobar Islands', 'Andaman and Nicobar Islands', 'Andaman and Nicobar Islands', 'South', 'coastal', 11.7401, 92.6586],
];

const CITIES: Row[] = [
  // North
  ['Gurugram', 'Gurugram', 'Haryana', 'North', 'dry plains', 28.4595, 77.0266],
  ['Noida', 'Gautam Buddh Nagar', 'Uttar Pradesh', 'North', 'dry plains', 28.5355, 77.391],
  ['Lucknow', 'Lucknow', 'Uttar Pradesh', 'North', 'dry plains', 26.8467, 80.9462],
  ['Kanpur', 'Kanpur Nagar', 'Uttar Pradesh', 'North', 'dry plains', 26.4499, 80.3319],
  ['Varanasi', 'Varanasi', 'Uttar Pradesh', 'North', 'river valley', 25.3176, 82.9739],
  ['Agra', 'Agra', 'Uttar Pradesh', 'North', 'dry plains', 27.1767, 78.0081],
  ['Gorakhpur', 'Gorakhpur', 'Uttar Pradesh', 'North', 'dry plains', 26.7606, 83.3732],
  ['Jhansi', 'Jhansi', 'Uttar Pradesh', 'North', 'dry plains', 25.4484, 78.5685],
  ['Babina', 'Jhansi', 'Uttar Pradesh', 'North', 'dry plains', 25.2436, 78.4735],
  ['Meerut', 'Meerut', 'Uttar Pradesh', 'North', 'dry plains', 28.9845, 77.7064],
  ['Faridabad', 'Faridabad', 'Haryana', 'North', 'dry plains', 28.4089, 77.3178],
  ['Kurukshetra', 'Kurukshetra', 'Haryana', 'North', 'dry plains', 29.9695, 76.8783],
  ['Surajkund', 'Faridabad', 'Haryana', 'North', 'dry plains', 28.4646, 77.2854],
  ['Kalesar', 'Yamunanagar', 'Haryana', 'North', 'dry plains', 30.4167, 77.4833],
  ['Anandpur Sahib', 'Rupnagar', 'Punjab', 'North', 'dry plains', 31.2372, 76.5013],
  ['Dalhousie', 'Chamba', 'Himachal Pradesh', 'North', 'hills', 32.5387, 75.9701],
  ['Paonta Sahib', 'Sirmaur', 'Himachal Pradesh', 'North', 'hills', 30.4373, 77.6247],
  ['Sonamarg', 'Ganderbal', 'Jammu and Kashmir', 'North', 'hills', 34.3011, 75.2903],
  ['Amarnath', 'Anantnag', 'Jammu and Kashmir', 'North', 'hills', 34.2163, 75.5008],
  ['Zanskar', 'Kargil', 'Ladakh', 'North', 'hills', 33.5, 77.0],
  ['Pangong', 'Leh', 'Ladakh', 'North', 'hills', 33.7526, 78.6614],
  ['Badrinath', 'Chamoli', 'Uttarakhand', 'North', 'hills', 30.7433, 79.4938],
  ['Kedarnath', 'Rudraprayag', 'Uttarakhand', 'North', 'hills', 30.7346, 79.0669],
  ['Yamunotri', 'Uttarkashi', 'Uttarakhand', 'North', 'hills', 31.01, 78.45],
  ['Roopkund', 'Chamoli', 'Uttarakhand', 'North', 'hills', 30.2599, 79.7327],
  ['Tungnath', 'Rudraprayag', 'Uttarakhand', 'North', 'hills', 30.4886, 79.2192],
  ['Nanda Devi', 'Chamoli', 'Uttarakhand', 'North', 'hills', 30.3628, 79.9705],
  ['Madhyamaheshwar', 'Rudraprayag', 'Uttarakhand', 'North', 'hills', 30.6667, 79.1167],
  ['Silkyara', 'Uttarkashi', 'Uttarakhand', 'North', 'hills', 30.8333, 78.4167],
  ['Dibrughetta', 'Chamoli', 'Uttarakhand', 'North', 'hills', 30.35, 79.85],
  ['Amritsar', 'Amritsar', 'Punjab', 'North', 'dry plains', 31.634, 74.8723],
  ['Chandigarh', 'Chandigarh', 'Punjab', 'North', 'dry plains', 30.7333, 76.7794],
  ['Dehradun', 'Dehradun', 'Uttarakhand', 'North', 'hills', 30.3165, 78.0322],
  ['Mussoorie', 'Dehradun', 'Uttarakhand', 'North', 'hills', 30.4599, 78.0664],
  ['Rishikesh', 'Dehradun', 'Uttarakhand', 'North', 'river valley', 30.0869, 78.2676],
  ['Haridwar', 'Haridwar', 'Uttarakhand', 'North', 'river valley', 29.9457, 78.1642],
  ['Nainital', 'Nainital', 'Uttarakhand', 'North', 'hills', 29.3919, 79.4542],
  ['Shimla', 'Shimla', 'Himachal Pradesh', 'North', 'hills', 31.1048, 77.1734],
  ['Manali', 'Kullu', 'Himachal Pradesh', 'North', 'hills', 32.2396, 77.1887],
  ['Dharamshala', 'Kangra', 'Himachal Pradesh', 'North', 'hills', 32.219, 76.3234],
  ['Leh', 'Leh', 'Ladakh', 'North', 'hills', 34.1526, 77.5771],
  ['Kargil', 'Kargil', 'Ladakh', 'North', 'hills', 34.5539, 76.1349],
  ['Nubra', 'Leh', 'Ladakh', 'North', 'hills', 34.6868, 77.5619],
  ['Srinagar', 'Srinagar', 'Jammu and Kashmir', 'North', 'hills', 34.0837, 74.7973],
  ['Jammu', 'Jammu', 'Jammu and Kashmir', 'North', 'hills', 32.7266, 74.857],

  // West
  ['Jaipur', 'Jaipur', 'Rajasthan', 'West', 'desert', 26.9124, 75.7873],
  ['Jodhpur', 'Jodhpur', 'Rajasthan', 'West', 'desert', 26.2389, 73.0243],
  ['Udaipur', 'Udaipur', 'Rajasthan', 'West', 'desert', 24.5854, 73.7125],
  ['Jaisalmer', 'Jaisalmer', 'Rajasthan', 'West', 'desert', 26.9157, 70.9083],
  ['Bikaner', 'Bikaner', 'Rajasthan', 'West', 'desert', 28.0229, 73.3119],
  ['Khichan', 'Jodhpur', 'Rajasthan', 'West', 'desert', 27.1333, 72.6667],
  ['Pushkar', 'Ajmer', 'Rajasthan', 'West', 'desert', 26.4899, 74.5511],
  ['Ajmer', 'Ajmer', 'Rajasthan', 'West', 'desert', 26.4499, 74.6399],
  ['Mumbai', 'Mumbai', 'Maharashtra', 'West', 'coastal', 19.076, 72.8777],
  ['Pune', 'Pune', 'Maharashtra', 'West', 'plateau', 18.5204, 73.8567],
  ['Nashik', 'Nashik', 'Maharashtra', 'West', 'plateau', 19.9975, 73.7898],
  ['Nagpur', 'Nagpur', 'Maharashtra', 'West', 'plateau', 21.1458, 79.0882],
  ['Ahmedabad', 'Ahmedabad', 'Gujarat', 'West', 'dry plains', 23.0225, 72.5714],
  ['Surat', 'Surat', 'Gujarat', 'West', 'coastal', 21.1702, 72.8311],
  ['Bhuj', 'Kachchh', 'Gujarat', 'West', 'desert', 23.242, 69.6669],
  ['Panaji', 'North Goa', 'Goa', 'West', 'coastal', 15.4909, 73.8278],
  ['Vadodara', 'Vadodara', 'Gujarat', 'West', 'dry plains', 22.3072, 73.1812],
  ['Porbandar', 'Porbandar', 'Gujarat', 'West', 'coastal', 21.6417, 69.6293],
  ['Alang', 'Bhavnagar', 'Gujarat', 'West', 'coastal', 21.4167, 72.1833],
  ['Lothal', 'Ahmedabad', 'Gujarat', 'West', 'dry plains', 22.5227, 72.2494],
  ['Thol', 'Mehsana', 'Gujarat', 'West', 'dry plains', 23.2, 72.4167],
  ['Bharatpur', 'Bharatpur', 'Rajasthan', 'West', 'desert', 27.2152, 77.49],
  ['Talashil', 'North Goa', 'Goa', 'West', 'coastal', 15.5167, 73.8],

  // Central
  ['Bhopal', 'Bhopal', 'Madhya Pradesh', 'Central', 'plateau', 23.2599, 77.4126],
  ['Indore', 'Indore', 'Madhya Pradesh', 'Central', 'plateau', 22.7196, 75.8577],
  ['Jabalpur', 'Jabalpur', 'Madhya Pradesh', 'Central', 'plateau', 23.1815, 79.9864],
  ['Gwalior', 'Gwalior', 'Madhya Pradesh', 'Central', 'plateau', 26.2183, 78.1828],
  ['Chhindwara', 'Chhindwara', 'Madhya Pradesh', 'Central', 'plateau', 22.0574, 78.9382],
  ['Raipur', 'Raipur', 'Chhattisgarh', 'Central', 'plateau', 21.2514, 81.6296],
  ['Ujjain', 'Ujjain', 'Madhya Pradesh', 'Central', 'plateau', 23.1765, 75.7885],

  // East
  ['Kolkata', 'Kolkata', 'West Bengal', 'East', 'delta', 22.5726, 88.3639],
  ['Darjeeling', 'Darjeeling', 'West Bengal', 'East', 'hills', 27.041, 88.2663],
  ['Sundarbans', 'South 24 Parganas', 'West Bengal', 'East', 'delta', 21.9497, 88.9],
  ['Gangasagar', 'South 24 Parganas', 'West Bengal', 'East', 'delta', 21.6497, 88.0839],
  ['Patna', 'Patna', 'Bihar', 'East', 'river valley', 25.5941, 85.1376],
  ['Ranchi', 'Ranchi', 'Jharkhand', 'East', 'plateau', 23.3441, 85.3096],
  ['Bhubaneswar', 'Khordha', 'Odisha', 'East', 'coastal', 20.2961, 85.8245],
  ['Puri', 'Puri', 'Odisha', 'East', 'coastal', 19.8135, 85.8312],

  // Northeast
  ['Guwahati', 'Kamrup Metropolitan', 'Assam', 'Northeast', 'river valley', 26.1445, 91.7362],
  ['Kaziranga', 'Golaghat', 'Assam', 'Northeast', 'river valley', 26.5775, 93.1711],
  ['Shillong', 'East Khasi Hills', 'Meghalaya', 'Northeast', 'hills', 25.5788, 91.8933],
  ['Sohra', 'East Khasi Hills', 'Meghalaya', 'Northeast', 'hills', 25.2702, 91.7323],
  ['Aizawl', 'Aizawl', 'Mizoram', 'Northeast', 'hills', 23.7271, 92.7176],
  ['Imphal', 'Imphal West', 'Manipur', 'Northeast', 'hills', 24.817, 93.9368],
  ['Kohima', 'Kohima', 'Nagaland', 'Northeast', 'hills', 25.6751, 94.11],
  ['Itanagar', 'Papum Pare', 'Arunachal Pradesh', 'Northeast', 'hills', 27.0844, 93.6053],
  ['Gangtok', 'Gangtok', 'Sikkim', 'Northeast', 'hills', 27.3389, 88.6065],
  ['Agartala', 'West Tripura', 'Tripura', 'Northeast', 'hills', 23.8315, 91.2868],

  // South
  ['Bengaluru', 'Bengaluru Urban', 'Karnataka', 'South', 'plateau', 12.9716, 77.5946],
  ['Mysuru', 'Mysuru', 'Karnataka', 'South', 'plateau', 12.2958, 76.6394],
  ['Mangaluru', 'Dakshina Kannada', 'Karnataka', 'South', 'coastal', 12.9141, 74.856],
  ['Hampi', 'Vijayanagara', 'Karnataka', 'South', 'plateau', 15.335, 76.462],
  ['Chennai', 'Chennai', 'Tamil Nadu', 'South', 'coastal', 13.0827, 80.2707],
  ['Madurai', 'Madurai', 'Tamil Nadu', 'South', 'dry plains', 9.9252, 78.1198],
  ['Coimbatore', 'Coimbatore', 'Tamil Nadu', 'South', 'plateau', 11.0168, 76.9558],
  ['Ooty', 'Nilgiris', 'Tamil Nadu', 'South', 'hills', 11.4064, 76.6932],
  ['Kodaikanal', 'Dindigul', 'Tamil Nadu', 'South', 'hills', 10.2381, 77.4892],
  ['Puducherry', 'Puducherry', 'Tamil Nadu', 'South', 'coastal', 11.9416, 79.8083],
  ['Auroville', 'Viluppuram', 'Tamil Nadu', 'South', 'coastal', 12.0068, 79.8097],
  ['Karkala', 'Udupi', 'Karnataka', 'South', 'coastal', 13.2107, 74.9931],
  ['Karimnagar', 'Karimnagar', 'Telangana', 'South', 'plateau', 18.4386, 79.1288],
  ['Nandurbar', 'Nandurbar', 'Maharashtra', 'West', 'plateau', 21.3667, 74.25],
  ['Kochi', 'Ernakulam', 'Kerala', 'South', 'coastal', 9.9312, 76.2673],
  ['Thiruvananthapuram', 'Thiruvananthapuram', 'Kerala', 'South', 'coastal', 8.5241, 76.9366],
  ['Alappuzha', 'Alappuzha', 'Kerala', 'South', 'delta', 9.4981, 76.3388],
  ['Munnar', 'Idukki', 'Kerala', 'South', 'hills', 10.0889, 77.0595],
  ['Hyderabad', 'Hyderabad', 'Telangana', 'South', 'plateau', 17.385, 78.4867],
  ['Visakhapatnam', 'Visakhapatnam', 'Andhra Pradesh', 'South', 'coastal', 17.6868, 83.2185],
  ['Tirupati', 'Tirupati', 'Andhra Pradesh', 'South', 'plateau', 13.6288, 79.4192],

  // Added from the corpus — these appeared repeatedly in videos that failed
  // to place. Jabbarkhet is Wilderness Films' own Himalayan arboretum and
  // shows up hundreds of times.
  ['Jabbarkhet', 'Dehradun', 'Uttarakhand', 'North', 'hills', 30.4667, 78.0833],
  ['Uttarkashi', 'Uttarkashi', 'Uttarakhand', 'North', 'hills', 30.7268, 78.4354],
  ['Tehri', 'Tehri Garhwal', 'Uttarakhand', 'North', 'hills', 30.3777, 78.4803],
  ['Chamoli', 'Chamoli', 'Uttarakhand', 'North', 'hills', 30.4227, 79.3260],
  ['Pithoragarh', 'Pithoragarh', 'Uttarakhand', 'North', 'hills', 29.5829, 80.2182],
  ['Almora', 'Almora', 'Uttarakhand', 'North', 'hills', 29.5892, 79.6467],
  ['Corbett', 'Nainital', 'Uttarakhand', 'North', 'hills', 29.5300, 78.7747],
  ['Landour', 'Dehradun', 'Uttarakhand', 'North', 'hills', 30.4598, 78.0908],
  ['Siliguri', 'Darjeeling', 'West Bengal', 'East', 'dry plains', 26.7271, 88.3953],
  ['Thrissur', 'Thrissur', 'Kerala', 'South', 'coastal', 10.5276, 76.2144],
  ['Kozhikode', 'Kozhikode', 'Kerala', 'South', 'coastal', 11.2588, 75.7804],
  ['Wayanad', 'Wayanad', 'Kerala', 'South', 'hills', 11.6854, 76.1320],
  ['Kanyakumari', 'Kanyakumari', 'Tamil Nadu', 'South', 'coastal', 8.0883, 77.5385],
  ['Rameswaram', 'Ramanathapuram', 'Tamil Nadu', 'South', 'coastal', 9.2876, 79.3129],
  ['Kaziranga', 'Golaghat', 'Assam', 'Northeast', 'river valley', 26.5775, 93.1711],
  ['Majuli', 'Majuli', 'Assam', 'Northeast', 'river valley', 26.9500, 94.1667],
  ['Tawang', 'Tawang', 'Arunachal Pradesh', 'Northeast', 'hills', 27.5861, 91.8594],
  ['Ziro', 'Lower Subansiri', 'Arunachal Pradesh', 'Northeast', 'hills', 27.6325, 93.8256],
  ['Ranthambore', 'Sawai Madhopur', 'Rajasthan', 'West', 'desert', 26.0173, 76.5026],
  ['Jawai', 'Pali', 'Rajasthan', 'West', 'desert', 25.1000, 73.1500],
  ['Mount Abu', 'Sirohi', 'Rajasthan', 'West', 'hills', 24.5926, 72.7156],
  ['Bandhavgarh', 'Umaria', 'Madhya Pradesh', 'Central', 'plateau', 23.7126, 81.0289],
  ['Kanha', 'Mandla', 'Madhya Pradesh', 'Central', 'plateau', 22.3345, 80.6115],
  ['Pench', 'Seoni', 'Madhya Pradesh', 'Central', 'plateau', 21.6667, 79.3000],
  ['Panna', 'Panna', 'Madhya Pradesh', 'Central', 'plateau', 24.7180, 80.1810],
  ['Khajuraho', 'Chhatarpur', 'Madhya Pradesh', 'Central', 'plateau', 24.8318, 79.9199],
  ['Gir', 'Junagadh', 'Gujarat', 'West', 'dry plains', 21.1244, 70.8242],
  ['Rann of Kutch', 'Kachchh', 'Gujarat', 'West', 'desert', 23.7337, 69.8597],
  ['Lonavala', 'Pune', 'Maharashtra', 'West', 'hills', 18.7546, 73.4062],
  ['Matheran', 'Raigad', 'Maharashtra', 'West', 'hills', 18.9866, 73.2707],
  ['Kolhapur', 'Kolhapur', 'Maharashtra', 'West', 'plateau', 16.7050, 74.2433],
  ['Aurangabad', 'Aurangabad', 'Maharashtra', 'West', 'plateau', 19.8762, 75.3433],
  ['Coorg', 'Kodagu', 'Karnataka', 'South', 'hills', 12.3375, 75.8069],
  ['Bandipur', 'Chamarajanagar', 'Karnataka', 'South', 'plateau', 11.6600, 76.6300],
  ['Konark', 'Puri', 'Odisha', 'East', 'coastal', 19.8876, 86.0945],
  ['Chilika', 'Khordha', 'Odisha', 'East', 'coastal', 19.7167, 85.3167],
  ['Bodh Gaya', 'Gaya', 'Bihar', 'East', 'river valley', 24.6960, 84.9920],
  ['Rishikesh', 'Dehradun', 'Uttarakhand', 'North', 'river valley', 30.0869, 78.2676],
  ['Allahabad', 'Prayagraj', 'Uttar Pradesh', 'North', 'river valley', 25.4358, 81.8463],
  ['Ayodhya', 'Ayodhya', 'Uttar Pradesh', 'North', 'dry plains', 26.7922, 82.1998],
  ['Mathura', 'Mathura', 'Uttar Pradesh', 'North', 'dry plains', 27.4924, 77.6737],
  ['Spiti', 'Lahaul and Spiti', 'Himachal Pradesh', 'North', 'hills', 32.2464, 78.0349],
  ['Kullu', 'Kullu', 'Himachal Pradesh', 'North', 'hills', 31.9578, 77.1092],
];

/**
 * Places outside India.
 *
 * Included deliberately, not by omission. The archive holds ~3,800 clips shot
 * outside India — Nepal (835), Bhutan (803) and Tibet (445) most of all, which
 * is unsurprising for a Himalayan production house. Leaving them unplaceable
 * would show real footage with a blank location line and quietly re-impose an
 * India-only assumption the collection itself contradicts (AUDIT.md §K).
 *
 * Kept deliberately shallow: capital/major cities plus a country-level row, so
 * a clip resolves to "Kathmandu, Nepal" or just "Nepal". We are not building a
 * world gazetteer, only enough to caption footage honestly.
 */
const WORLD: WorldRow[] = [
  // Himalayan neighbours — the bulk of the non-India material
  ['Nepal', 'Nepal', 'Nepal', 'hills', 28.3949, 84.124],
  ['Kathmandu', 'Bagmati', 'Nepal', 'hills', 27.7172, 85.324],
  ['Pokhara', 'Gandaki', 'Nepal', 'hills', 28.2096, 83.9856],
  ['Chitwan', 'Bagmati', 'Nepal', 'river valley', 27.5291, 84.3542],
  ['Lumbini', 'Lumbini', 'Nepal', 'dry plains', 27.4833, 83.2767],
  ['Bhaktapur', 'Bagmati', 'Nepal', 'hills', 27.671, 85.4298],
  ['Nagarkot', 'Bagmati', 'Nepal', 'hills', 27.7154, 85.5209],
  ['Annapurna', 'Gandaki', 'Nepal', 'hills', 28.5961, 83.8203],
  ['Everest', 'Solukhumbu', 'Nepal', 'hills', 27.9881, 86.925],

  ['Bhutan', 'Bhutan', 'Bhutan', 'hills', 27.5142, 90.4336],
  ['Thimphu', 'Thimphu', 'Bhutan', 'hills', 27.4712, 89.6339],
  ['Paro', 'Paro', 'Bhutan', 'hills', 27.4305, 89.4133],
  ['Punakha', 'Punakha', 'Bhutan', 'hills', 27.5921, 89.8797],
  ['Bumthang', 'Bumthang', 'Bhutan', 'hills', 27.6421, 90.7376],
  ['Trongsa', 'Trongsa', 'Bhutan', 'hills', 27.5026, 90.5071],

  /*
   * Tibet is recorded as its own country value rather than folded into China.
   * This is descriptive, not a sovereignty claim: the footage and its metadata
   * say "Tibet", much of it filmed among Tibetan communities in India, and
   * relabelling it would assert a position the source material does not.
   *
   * "Kailash" is deliberately NOT a row. It collides with the singer Kailash
   * Kher, who appears throughout this archive — it mislabelled 100 music
   * interviews as Tibetan mountain footage. Reachable via the alias
   * "kailash mansarovar" instead, which is unambiguous.
   */
  ['Tibet', 'Tibet', 'Tibet', 'plateau', 31.6927, 88.0924],
  ['Lhasa', 'Tibet', 'Tibet', 'plateau', 29.652, 91.1721],

  // South Asia
  ['Bangladesh', 'Bangladesh', 'Bangladesh', 'delta', 23.685, 90.3563],
  ['Dhaka', 'Dhaka', 'Bangladesh', 'delta', 23.8103, 90.4125],
  ['Chittagong', 'Chattogram', 'Bangladesh', 'coastal', 22.3569, 91.7832],
  ['Sri Lanka', 'Sri Lanka', 'Sri Lanka', 'coastal', 7.8731, 80.7718],
  ['Colombo', 'Western', 'Sri Lanka', 'coastal', 6.9271, 79.8612],
  ['Pakistan', 'Pakistan', 'Pakistan', 'dry plains', 30.3753, 69.3451],
  ['Afghanistan', 'Afghanistan', 'Afghanistan', 'dry plains', 33.9391, 67.71],
  ['Kabul', 'Kabul', 'Afghanistan', 'dry plains', 34.5553, 69.2075],
  ['Maldives', 'Maldives', 'Maldives', 'coastal', 3.2028, 73.2207],
  ['Myanmar', 'Myanmar', 'Myanmar', 'river valley', 21.9162, 95.956],

  // Africa
  ['Kenya', 'Kenya', 'Kenya', 'dry plains', -0.0236, 37.9062],
  ['Masai Mara', 'Narok', 'Kenya', 'dry plains', -1.4061, 35.0078],
  ['Tanzania', 'Tanzania', 'Tanzania', 'dry plains', -6.369, 34.8888],

  // Southeast and East Asia
  ['Thailand', 'Thailand', 'Thailand', 'coastal', 15.87, 100.9925],
  ['Bangkok', 'Bangkok', 'Thailand', 'delta', 13.7563, 100.5018],
  ['Indonesia', 'Indonesia', 'Indonesia', 'coastal', -0.7893, 113.9213],
  ['Bali', 'Bali', 'Indonesia', 'coastal', -8.3405, 115.092],
  ['Singapore', 'Singapore', 'Singapore', 'coastal', 1.3521, 103.8198],
  ['Cambodia', 'Cambodia', 'Cambodia', 'dry plains', 12.5657, 104.991],
  ['Laos', 'Laos', 'Laos', 'hills', 19.8563, 102.4955],
  ['Vietnam', 'Vietnam', 'Vietnam', 'coastal', 14.0583, 108.2772],
  ['Japan', 'Japan', 'Japan', 'coastal', 36.2048, 138.2529],

  // Middle East, Europe, Americas
  ['Dubai', 'Dubai', 'United Arab Emirates', 'desert', 25.2048, 55.2708],
  ['Abu Dhabi', 'Abu Dhabi', 'United Arab Emirates', 'desert', 24.4539, 54.3773],
  ['London', 'England', 'United Kingdom', 'coastal', 51.5074, -0.1278],
  ['France', 'France', 'France', 'coastal', 46.2276, 2.2137],
  ['Paris', 'Ile-de-France', 'France', 'dry plains', 48.8566, 2.3522],
  ['Amsterdam', 'North Holland', 'Netherlands', 'delta', 52.3676, 4.9041],
  ['Switzerland', 'Switzerland', 'Switzerland', 'hills', 46.8182, 8.2275],
  ['Geneva', 'Geneva', 'Switzerland', 'hills', 46.2044, 6.1432],
];

/** Spelling variants and older names that appear in titles and hashtags. */
const ALIASES: Record<string, string> = {
  alleppey: 'alappuzha',
  cherrapunji: 'sohra',
  cherrapunjee: 'sohra',
  mangalore: 'mangaluru',
  bangalore: 'bengaluru',
  bengaluru: 'bengaluru',
  mysore: 'mysuru',
  cochin: 'kochi',
  trivandrum: 'thiruvananthapuram',
  calcutta: 'kolkata',
  bombay: 'mumbai',
  madras: 'chennai',
  poona: 'pune',
  benares: 'varanasi',
  banaras: 'varanasi',
  kashi: 'varanasi',
  gurgaon: 'gurugram',
  pondicherry: 'puducherry',
  orissa: 'odisha',
  uttaranchal: 'uttarakhand',
  'j&k': 'jammu and kashmir',
  himachal: 'himachal pradesh',
  'new delhi': 'delhi',
  ncr: 'delhi',
  gurugram: 'gurugram',
  prayagraj: 'allahabad',
  cherrapunji_dup: 'sohra',
  kaziranga: 'kaziranga',
  'jim corbett': 'corbett',
  'corbett national park': 'corbett',
  kodagu: 'coorg',
  'rann of kachchh': 'rann of kutch',
  'garhwal': 'uttarakhand',
  'kumaon': 'uttarakhand',
  'bundelkhand': 'jhansi',
  kutch: 'bhuj',
  kachchh: 'bhuj',
  nilgiris: 'ooty',
  udhagamandalam: 'ooty',

  // misspellings/variants found in playlist titles during the archive audit
  baroda: 'vadodara',
  porbander: 'porbandar',
  kodaikana: 'kodaikanal',
  cherranpunji: 'sohra',
  chhatisgarh: 'chhattisgarh',
  nainita: 'nainital',
  nasik: 'nashik',
  'kailash mansarovar': 'tibet',
  'mount kailash': 'tibet',
  'the andamans': 'andaman and nicobar islands',
  andamans: 'andaman and nicobar islands',

  // landmarks that are not their own settlement — aliased to the city they
  // sit inside, found the same way
  akshardham: 'delhi',
  'bangla sahib': 'delhi',
  'connaught place': 'delhi',
  'dilli haat': 'delhi',
  'jama masjid': 'delhi',
  'jantar mantar': 'delhi',
  'qutub minar': 'delhi',
  rajghat: 'delhi',
  'red fort': 'delhi',
  'tughlaqabad fort': 'delhi',
  'safdarjung tomb': 'delhi',
  'safdarjung hospital': 'delhi',
  'safdarjung': 'delhi',
  'hauz khas': 'delhi',
  'sarojini nagar': 'delhi',
  'taj mahal': 'agra',
};

function slug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

const places: Record<string, unknown> = {};

for (const [name, district, state, region, terrain, lat, lng] of STATES) {
  places[slug(name)] = { name, district, state, country: 'India', region, terrain, lat, lng, kind: 'state' };
}
// Cities are written after states so a name appearing in both wins as a city.
for (const [name, district, state, region, terrain, lat, lng] of CITIES) {
  places[slug(name)] = { name, district, state, country: 'India', region, terrain, lat, lng, kind: 'city' };
}

// Non-India rows. `kind` is 'city' when the row names a settlement and 'state'
// when it names a whole country, so the town-level filters behave sensibly.
for (const [name, state, country, terrain, lat, lng] of WORLD) {
  places[slug(name)] = {
    name,
    district: state,
    state,
    country,
    region: 'Outside India',
    terrain,
    lat,
    lng,
    kind: name === country || name === state ? 'state' : 'city',
  };
}

const out = {
  _note:
    'Generated by scripts/build-gazetteer.ts — edit that file, not this one. ' +
    'Coordinates are settlement centroids; state-level terrain is a simplification ' +
    'used only on the last rung of the retrieval fallback ladder.',
  aliases: ALIASES,
  places,
};

const file = path.join(process.cwd(), 'data', 'gazetteer.json');
writeFileSync(file, JSON.stringify(out, null, 2), 'utf8');

console.log(
  `Wrote ${Object.keys(places).length} places ` +
    `(${STATES.length} states/UTs, ${CITIES.length} cities) and ` +
    `${Object.keys(ALIASES).length} aliases to data/gazetteer.json`,
);
