import {AUTOMATION_OPTIONS,safeAutomationMode} from './core.mjs';

const sources=new Set(['calendar','email','school','finances','household']);
const recordActions=new Set(['create','edit','delete','send','payment','trade','share','permission-change']);

// This module only classifies UI suggestions. It cannot authorize or execute writes.
export function reviewAutomationSuggestion(suggestion,{mode='ask'}={}){
 if(!suggestion||typeof suggestion!=='object'||!sources.has(suggestion.source)||typeof suggestion.id!=='string'||!suggestion.id||typeof suggestion.rule!=='string'||!suggestion.rule||typeof suggestion.reason!=='string'||!suggestion.reason.trim()||typeof suggestion.uncertainty!=='string'||!suggestion.uncertainty.trim()||!Number.isFinite(suggestion.confidence)||suggestion.confidence<0||suggestion.confidence>1)throw Error('Suggestion provenance and uncertainty could not be verified.');
 const effectiveMode=AUTOMATION_OPTIONS.includes(mode)?mode:'ask',actionMode=safeAutomationMode(suggestion.rule,effectiveMode);
 const visible=effectiveMode!=='disabled';
 return {visible,effectiveMode,actionMode,confidence:suggestion.confidence,provenance:{source:suggestion.source,sourceId:typeof suggestion.sourceId==='string'?suggestion.sourceId:null,sourceVersion:Number.isInteger(suggestion.sourceVersion)&&suggestion.sourceVersion>0?suggestion.sourceVersion:null,rule:suggestion.rule},uncertainty:suggestion.uncertainty,requiresExplicitApproval:true,recordWriteAllowed:false,externalActionAllowed:false};
}

export function automationActionPolicy(action){return {known:recordActions.has(action),requiresExplicitApproval:true,automaticAllowed:false};}
