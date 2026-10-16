import * as DocumentPicker from 'expo-document-picker';
import {File,Paths} from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {exportProject,importProject,type Project} from '@choreoflow/core';
export async function saveProjectFile(project:Project){const file=new File(Paths.cache,'choreoflow-project.json');file.write(exportProject(project));await Sharing.shareAsync(file.uri,{mimeType:'application/json',UTI:'public.json'});}
export async function pickProject():Promise<Project|null>{const result=await DocumentPicker.getDocumentAsync({type:'application/json',copyToCacheDirectory:true});if(result.canceled)return null;const asset=result.assets[0];if((asset.size??0)>10*1024*1024)throw new Error('Projektdatei ist größer als 10 MB.');return importProject(await new File(asset.uri).text());}
export async function exportPng(_project:Project,_time:number){throw new Error('Der native PNG-Export ist noch nicht implementiert. Exportiere vorerst die portable Projektdatei.');}
