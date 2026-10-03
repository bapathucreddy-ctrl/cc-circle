import {resolve} from 'node:path';
import {createDb} from './db.js';
import {createApp} from './app.js';
const dataRoot=resolve(process.env.DATA_DIR||'server/data');
const db=createDb(resolve(dataRoot,'circle.sqlite'));
const app=createApp(db,{uploadRoot:resolve(dataRoot,'uploads'),allowedOrigins:(process.env.APP_ORIGINS||'http://localhost:8081,http://localhost:19006').split(','),bootstrapAdminEmail:process.env.ADMIN_EMAIL,bootstrapAdminPassword:process.env.ADMIN_PASSWORD,youtube:{clientId:process.env.GOOGLE_CLIENT_ID,clientSecret:process.env.GOOGLE_CLIENT_SECRET,redirectUri:process.env.GOOGLE_REDIRECT_URI},instagram:{clientId:process.env.INSTAGRAM_CLIENT_ID,clientSecret:process.env.INSTAGRAM_CLIENT_SECRET,redirectUri:process.env.INSTAGRAM_REDIRECT_URI}});
const port=Number(process.env.PORT||3333);
app.listen(port,'0.0.0.0',()=>console.log(`CC Circle API listening on ${port}`));
