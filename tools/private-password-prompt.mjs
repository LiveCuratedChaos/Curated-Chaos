// Owner enters secrets only in a local terminal. Never log or accept password arguments.
export function hiddenPassword(prompt){
 if(!process.stdin.isTTY||typeof process.stdin.setRawMode!=='function')throw Error('Open this tool in a local Terminal to enter the recovery password privately.');
 return new Promise((yes,no)=>{
  let value='';const previous=process.stdin.isRaw;
  const done=(error)=>{process.stdin.off('data',input);process.stdin.setRawMode(previous);process.stdin.pause();process.stderr.write('\n');if(error)no(error);else yes(value);};
  const input=chunk=>{for(const char of chunk.toString('utf8')){if(char==='\u0003'){done(Error('Recovery cancelled.'));return;}if(char==='\r'||char==='\n'){done();return;}if(char==='\u007f'||char==='\b'){value=[...value].slice(0,-1).join('');continue;}if(char>=' '){value+=char;if(Buffer.byteLength(value)>1024){done(Error('Recovery password is too long.'));return;}}}};
  process.stderr.write(prompt);process.stdin.setRawMode(true);process.stdin.setEncoding('utf8');process.stdin.resume();process.stdin.on('data',input);
 });
}
