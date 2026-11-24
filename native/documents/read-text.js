// Reads bounded owner-selected bytes from stdin. No file paths or network requests.
ObjC.import('Foundation');
ObjC.import('AppKit');
ObjC.import('PDFKit');

const unavailable=()=>({text:'',method:'unavailable'});
function recognize(imageData){
 try{
  ObjC.import('Vision');
  const handler=$.VNImageRequestHandler.alloc.initWithDataOptions(imageData,$.NSDictionary.dictionary);
  const request=$.VNRecognizeTextRequest.alloc.init;
  request.recognitionLevel=0;
  request.recognitionLanguages=['en-US'];
  request.usesLanguageCorrection=false;
  if(!handler.performRequestsError($.NSArray.arrayWithObject(request),Ref()))return unavailable();
  const lines=[];
  for(let i=0;i<request.results.count;i++){
   const options=request.results.objectAtIndex(i).topCandidates(1);
   if(options.count)lines.push(ObjC.unwrap(options.firstObject.string));
  }
  return {text:lines.join('\n'),method:'ocr'};
 }catch{return unavailable();}
}
function imagePage(data){
 try{
  ObjC.import('ImageIO');
  const source=$.CGImageSourceCreateWithData(data,null);
  if(!source||Number($.CGImageSourceGetCount(source))!==1)return unavailable();
  const thumbnail=$.CGImageSourceCreateThumbnailAtIndex(source,0,$({
   kCGImageSourceCreateThumbnailFromImageAlways:true,kCGImageSourceCreateThumbnailWithTransform:true,kCGImageSourceThumbnailMaxPixelSize:2000
  }));
  if(!thumbnail)return unavailable();
  const rep=$.NSBitmapImageRep.alloc.initWithCGImage(thumbnail);
  return recognize(rep.representationUsingTypeProperties(3,$.NSDictionary.dictionary));
 }catch{return unavailable();}
}
function run(args){
 const data=$.NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile;
 const reject=status=>JSON.stringify({status});
 if(data.length===0||data.length>8*1024*1024)return reject('unreadable');
 const scanned=args[1]==='recognize';
 let records=[];
 if(args[0]==='image'){
  if(!scanned)return reject('unreadable');
  records=[imagePage(data)];
 }else{
  const pdf=$.PDFDocument.alloc.initWithData(data);
  if(!pdf||pdf.isNil()||pdf.isLocked||pdf.pageCount<1||pdf.pageCount>80)return reject('unreadable');
  let scannedPages=0,total=0;
  for(let i=0;i<pdf.pageCount;i++){
   const page=pdf.pageAtIndex(i),text=ObjC.unwrap(page.string)||'';
   let item={text,method:'text'};
   if(!text.trim()&&scanned){
    scannedPages++;
    if(scannedPages>12)item=unavailable();
    else {
     try{item=recognize(page.thumbnailOfSizeForBox($.NSMakeSize(1400,1800),0).TIFFRepresentation);}
     catch{item=unavailable();}
    }
   }
   total+=item.text.length;
   if(item.text.length>24000||total>200000)return reject('unreadable');
   records.push(item);
  }
 }
 if(records.every(row=>row.method==='unavailable'))return reject('unavailable');
 return JSON.stringify({status:'ready',pages:records.map(row=>row.text),methods:records.map(row=>row.method)});
}
