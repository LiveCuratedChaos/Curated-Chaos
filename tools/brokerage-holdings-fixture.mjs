// Local fictional source for the signed-in preview. Never calls the network.
import {createBrokerageHoldingsSource} from '../server/private-brokerage-holdings.mjs';
export function createBrokerageFixture(){
 const ownerId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',account={id:'fixture-investment',name:'Fictional investment account'};
 return createBrokerageHoldingsSource({clientId:'fixture',secret:'fixture',loadGrant:async actor=>actor.ownerId===ownerId?{
  ownerId,environment:'sandbox',status:'authorized',scope:'investments',connectionId:'fictional-connection',revision:1,
  institutionId:'fixture-broker',institution:'Fictional brokerage',itemId:'fictional-item',accessToken:'access-sandbox-fictional',accounts:[account]}:null,
  fetcher:async()=>({ok:true,status:200,json:async()=>({item:{item_id:'fictional-item',institution_id:'fixture-broker'},accounts:[{account_id:account.id,type:'investment'}],
   securities:[{security_id:'fictional-fund',name:'Fictional index fund'}],holdings:[{account_id:account.id,security_id:'fictional-fund',quantity:10,
    iso_currency_code:'USD',institution_value:270,institution_price:27,institution_price_as_of:'2026-11-18'}]})})});
}
