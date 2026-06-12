export interface Province {
  id: string;
  adcode: number;
  name: string;
  nameEn: string;
  lit: boolean;
}

export const provinces: Province[] = [
  { id: "beijing", adcode: 110000, name: "北京", nameEn: "Beijing", lit: false },
  { id: "tianjin", adcode: 120000, name: "天津", nameEn: "Tianjin", lit: false },
  { id: "hebei", adcode: 130000, name: "河北", nameEn: "Hebei", lit: false },
  { id: "shanxi", adcode: 140000, name: "山西", nameEn: "Shanxi", lit: false },
  { id: "neimenggu", adcode: 150000, name: "内蒙古", nameEn: "Inner Mongolia", lit: false },
  { id: "liaoning", adcode: 210000, name: "辽宁", nameEn: "Liaoning", lit: false },
  { id: "jilin", adcode: 220000, name: "吉林", nameEn: "Jilin", lit: false },
  { id: "heilongjiang", adcode: 230000, name: "黑龙江", nameEn: "Heilongjiang", lit: false },
  { id: "shanghai", adcode: 310000, name: "上海", nameEn: "Shanghai", lit: true },
  { id: "jiangsu", adcode: 320000, name: "江苏", nameEn: "Jiangsu", lit: false },
  { id: "zhejiang", adcode: 330000, name: "浙江", nameEn: "Zhejiang", lit: true },
  { id: "anhui", adcode: 340000, name: "安徽", nameEn: "Anhui", lit: false },
  { id: "fujian", adcode: 350000, name: "福建", nameEn: "Fujian", lit: false },
  { id: "jiangxi", adcode: 360000, name: "江西", nameEn: "Jiangxi", lit: false },
  { id: "shandong", adcode: 370000, name: "山东", nameEn: "Shandong", lit: true },
  { id: "henan", adcode: 410000, name: "河南", nameEn: "Henan", lit: true },
  { id: "hubei", adcode: 420000, name: "湖北", nameEn: "Hubei", lit: false },
  { id: "hunan", adcode: 430000, name: "湖南", nameEn: "Hunan", lit: false },
  { id: "guangdong", adcode: 440000, name: "广东", nameEn: "Guangdong", lit: true },
  { id: "guangxi", adcode: 450000, name: "广西", nameEn: "Guangxi", lit: false },
  { id: "hainan", adcode: 460000, name: "海南", nameEn: "Hainan", lit: false },
  { id: "chongqing", adcode: 500000, name: "重庆", nameEn: "Chongqing", lit: false },
  { id: "sichuan", adcode: 510000, name: "四川", nameEn: "Sichuan", lit: false },
  { id: "guizhou", adcode: 520000, name: "贵州", nameEn: "Guizhou", lit: false },
  { id: "yunnan", adcode: 530000, name: "云南", nameEn: "Yunnan", lit: false },
  { id: "xizang", adcode: 540000, name: "西藏", nameEn: "Tibet", lit: false },
  { id: "shaanxi", adcode: 610000, name: "陕西", nameEn: "Shaanxi", lit: false },
  { id: "gansu", adcode: 620000, name: "甘肃", nameEn: "Gansu", lit: false },
  { id: "qinghai", adcode: 630000, name: "青海", nameEn: "Qinghai", lit: false },
  { id: "ningxia", adcode: 640000, name: "宁夏", nameEn: "Ningxia", lit: false },
  { id: "xinjiang", adcode: 650000, name: "新疆", nameEn: "Xinjiang", lit: false },
  { id: "taiwan", adcode: 710000, name: "台湾", nameEn: "Taiwan", lit: false },
  { id: "hongkong", adcode: 810000, name: "香港", nameEn: "Hong Kong", lit: true },
  { id: "macau", adcode: 820000, name: "澳门", nameEn: "Macau", lit: true },
];

export const TOTAL_PROVINCES = provinces.length;
export const litProvinceCount = provinces.filter((province) => province.lit).length;

export const getProvince = (id: string): Province | undefined =>
  provinces.find((province) => province.id === id);
