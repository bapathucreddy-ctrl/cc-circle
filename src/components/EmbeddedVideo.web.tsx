import React from 'react';

export default function EmbeddedVideo({url,onError}:{url:string;onError:()=>void}){
 return <iframe title="Portfolio video" src={url} sandbox="allow-scripts allow-same-origin allow-presentation" allow="fullscreen; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onError={onError} style={{display:'block',width:'100%',height:'100%',border:0,background:'#000'}}/>;
}
