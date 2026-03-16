const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');

const pdfPath = path.join(__dirname, '../Deluxe Hero\'s Handbook 10th Year Edition - Copy.pdf');

async function peek() {
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdf(dataBuffer);
  
  console.log('--- PDF TEXT PEEK (First 5000 chars) ---');
  console.log(data.text.substring(0, 5000));
}

peek().catch(err => console.error(err));
