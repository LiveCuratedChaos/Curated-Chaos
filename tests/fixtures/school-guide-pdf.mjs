// Small standards-compliant fictional text PDFs for local extraction acceptance.
export function schoolGuidePdf(pages){
 const objects=['','<< /Type /Catalog /Pages 2 0 R >>','','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 const ids=[];
 for(const lines of pages){
  const id=objects.length;ids.push(id);
  const escape=line=>line.replace(/[()\\]/g,ch=>'\\'+ch);
  const content='BT /F1 12 Tf 50 700 Td 16 TL '+lines.map(t=>'('+escape(t)+') Tj T*').join(' ')+' ET';
  objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents '+(id+1)+' 0 R >>','<< /Length '+Buffer.byteLength(content)+' >>\nstream\n'+content+'\nendstream');
 }
 objects[2]='<< /Type /Pages /Count '+ids.length+' /Kids ['+ids.map(id=>id+' 0 R').join(' ')+'] >>';
 let file='%PDF-1.4\n';const offsets=[0];
 for(let i=1;i<objects.length;i++){offsets.push(Buffer.byteLength(file));file+=i+' 0 obj\n'+objects[i]+'\nendobj\n';}
 const xref=Buffer.byteLength(file);file+='xref\n0 '+objects.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+
  'trailer\n<< /Size '+objects.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
 return Buffer.from(file);
}
