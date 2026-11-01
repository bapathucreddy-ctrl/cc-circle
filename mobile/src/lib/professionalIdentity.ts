/** Identity names must not contain business or promotional content. Server repeats validation. */
export function validateProfessionalName(value: string) {
 const name=value.trim().replace(/\s+/g,' ');
 if(name.length<2||name.length>120||!/^\p{L}[\p{L}\p{M} .’'-]*$/u.test(name)||/(?:^|\s)(?:makeup|photographer|photography|editor|editing|studio|salon|artist|stylist|bridal|wedding|official|booking|best|brand|company|production|creative|dancer|actor|media|agency|services?|offers?)(?:\s|$)/i.test(name))throw new Error('Enter your real full name without profession, business names or promotional text.');
 return name;
}
export const photoSoftware=['Adobe Lightroom','Capture One','Adobe Photoshop'];
export const videoSoftware=['Final Cut Pro (FCP)','DaVinci Resolve','Adobe After Effects','Adobe Premiere Pro'];
