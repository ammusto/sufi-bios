import * as XLSX from 'xlsx';

export const loadExcelFile = async (filename) => {
  try {
    const response = await fetch(`/data/${filename}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${filename}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    // Read as binary with proper options
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'array',
      cellDates: true,
      cellNF: false,
      cellText: false
    });
    
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with header row
    const data = XLSX.utils.sheet_to_json(sheet, {
      raw: false,
      defval: null
    });
    
    return data;
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    throw error;
  }
};

export const loadArticleJson = async (articleId) => {
  try {
    const numericId = articleId.replace('eweb_', '');
    const paddedId = numericId.padStart(3, '0');
    const response = await fetch(`/data/articles/${paddedId}.json`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch article ${paddedId}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error loading article ${articleId}:`, error);
    throw error;
  }
};

export const loadAllData = async () => {
  const [bios, info] = await Promise.all([
    loadExcelFile('bios.xlsx'),
    loadExcelFile('info.xlsx')
  ]);
  
  return { bios, info };
};