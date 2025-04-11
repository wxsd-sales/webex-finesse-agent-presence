import express from "express";
import cors from "cors";
import 'dotenv/config';
import fetch from "node-fetch";
import http from "http";
import https from "https";
import Webex from "./webex-lite.cjs";
import { Server } from "socket.io";
import { XMLParser } from "fast-xml-parser";

const port = process.env.PORT || 5000;
const app = express();
const server = http.createServer(app);
const io = new Server(server,{
  cors: {
    origin: "https://finesse1.dcloud.cisco.com",
    methods: ["GET", "POST"],
    //allowedHeaders: ["my-custom-header"],
    credentials: true
  }
} );

import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// console.log(__dirname + "/desktop");
// app.use(express.static(__dirname + "/desktop"));

app.use(express.static(__dirname+ '/public', {
  setHeaders: function(res, path){
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
}));


let subscribeUsers = ["tahanson"]
let domain = "cisco.com"
let finesseUsers = {};
let subscribedHash = {}; //{webexId: finesseId}
let presenceHash = {};   //{finesseId: {data: webexPresenceData, socket: socket.id} }
var webex;
const GADGET_MODE = process.env.GADGET_MODE.toLowerCase() === "true";

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const parser = new XMLParser({
  ignoreAttributes: false, // To include attributes in the output
  attributeNamePrefix: "@_",  // Prefix for attribute names
  // Other options as needed
});

app.use(cors());
// console.log(path.join(__dirname, 'src'));
// app.use(express.static(path.join(__dirname, 'src')));
app.use(express.json());


async function getFinesseUsers(){
  let resp = await fetch('https://finesse1.dcloud.cisco.com/finesse/api/Users',{
      method: "GET",
      headers:{
        'Authorization': `Basic ${process.env.FINESSE_ADMIN_TOKEN}`
      },
      agent: httpsAgent
  });
  let xmlData = await resp.text();
  const jsonData = parser.parse(xmlData);
  if(jsonData?.Users?.User?.length > 0){
    for(let user of jsonData.Users.User){
      console.log(user);
      finesseUsers[user.loginName] = user;
    }
  }
}

async function getFinesseUserStatus(webexId){
  let resp = await fetch(`https://finesse1.dcloud.cisco.com/finesse/api/User/${subscribedHash[webexId]}`,{
    method: "GET",
    headers:{
      'Authorization': `Basic ${process.env.FINESSE_ADMIN_TOKEN}`
    },
    agent: httpsAgent
  });
  let xmlData = await resp.text();
  const jsonData = parser.parse(xmlData);
  console.log(jsonData);
  let state;
  if(jsonData?.User){
    state = jsonData.User.state;
    if(state.toLowerCase() === "not_ready"){
      return {state:state, reason:jsonData.User.reasonCodeId};
    } else {
      return {state};
    }
  } else {
    console.log("Error: User not found for getFinesseUserStatus");
    return {state};
  }
}

async function setFinesseUserStatus(webexId, state){
  console.log('setFinesseUserState setting user:', webexId);
  console.log('setFinesseUserState setting user to:', state);
  let resp = await fetch(`https://finesse1.dcloud.cisco.com/finesse/api/User/${subscribedHash[webexId]}`,{
    method: "PUT",
    headers:{
      'Authorization': `Basic ${process.env.FINESSE_SUPERVISOR_TOKEN}`,
      'Content-Type': 'application/xml'
    },
    agent: httpsAgent,
    body: `<User>
      <state>${state}</state>
    </User>`
  });
  console.log('setFinesseUserState result:');
  console.log(resp.status);
  let xmlData = await resp.text();
  console.log(xmlData);
}

async function syncUserPresence(presenceData){
  let webexId = presenceData.subject;
  console.log("syncUserPresence presenceData.subject", webexId);
  console.log("syncUserPresence presenceData.status", presenceData.status);
  console.log("syncUserPresence presenceData.meetingType", presenceData.meetingType);
  if(presenceHash[subscribedHash[webexId]]){
    presenceHash[subscribedHash[webexId]].data = presenceData;
    if(GADGET_MODE){
      if(presenceHash[subscribedHash[webexId]].socket){
        console.log(`syncUserPresence: emitting presence for user ${subscribedHash[webexId]}`)
        io.to(presenceHash[subscribedHash[webexId]].socket).emit("message", presenceData);
      } else {
        console.log("syncUserPresence: Server in gadget mode, but no socket for user yet.");
      }
    }
  } else {
    presenceHash[subscribedHash[webexId]] = {data: presenceData};
  }
  if(!GADGET_MODE){
    let userStatus = await getFinesseUserStatus(webexId);
    console.log("----------------------------");
    console.log('syncUserPresence: userStatus:');
    console.log(userStatus);
    if(presenceData.status === "dnd" || (presenceData.status === "meeting" && presenceData.meetingType === "online")){
      if(userStatus.state.toLowerCase() === "ready"){
        await setFinesseUserStatus(webexId, "NOT_READY");
      } else {
        console.log("syncUserPresence: No state change needed.")
      }
    } else {
      if(userStatus.state.toLowerCase() === "not_ready"){
        if([19, -1, undefined].indexOf(userStatus.reason) >= 0){
          await setFinesseUserStatus(webexId, "READY");
        } else {
          console.log("syncUserPresence: finessePresence was set by user - we cannot override.");
        }
      } else {
        console.log("syncUserPresence: No state change needed.")
      }
    }
    console.log("----------------------------");
  }
}

async function subscribePresence(id){
  try{
    await webex.internal.presence.subscribe(id, 600);
    console.log("subscribed...");
    const response = await webex.internal.presence.list([id]);
    console.log("******************************");
    console.log(response.statusList[0]);
    await syncUserPresence(response.statusList[0]);
    console.log("******************************");
    setInterval(async function(){
      try{
        console.log("resubscribing id:", id);
        await webex.internal.presence.subscribe(id, 600);
      }catch(ex){
        console.error("subscribePresence resubscribe error:");
        console.error(ex);
      }
    },1000 * 300);
  }catch(e){
    console.error("subscribePresence error:");
    console.error(e);
  }
}

async function subscribePresenceInitial(user){
  try {
    console.log("******* subscribePresenceInitial: *******");
    let email = `${user}@${domain}`;
    let people = await webex.people.list({email:email});
    if(people?.items.length > 0){
      console.log('people.items[0]:');
      console.log(people.items[0]);
      var idString = Buffer.from(people.items[0].id, 'base64').toString('utf-8');
      console.log(idString);
      let id = idString.split("/").slice(-1)[0]
      //console.log(id);
      subscribedHash[id] = finesseUsers[user].loginId;
      await subscribePresence(id);
    } else {
      console.error("Error: subscribePresenceInitial no user found for", email);
    }
  } catch(error) {
    console.error("subscribePresenceInitial Error:");
    console.error(error);
  }
};


// io.on('connection', (socket) => {
//   console.log('a user connected');
// });

app.get("/users", async function(req, res, next){
  res.setHeader('Content-Type',"application/json");
  res.send(JSON.stringify(presenceHash));
});

app.get("/user/:userId", async function(req, res, next){
  res.setHeader('Content-Type',"application/json");
  console.log(`GET /user/${req.params.userId}`);
  res.send(JSON.stringify(presenceHash[req.params.userId]));
})

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);
  socket.on('message', (msg) => {
    console.log(socket.id, "sent message:");
    console.log(msg);
    if(msg.id){
      if(presenceHash[msg.id]){
        presenceHash[msg.id].socket = socket.id;
        io.to(socket.id).emit("message", presenceHash[msg.id].data);
      } else {
        presenceHash[msg.id] = {socket: socket.id};
      }
      console.log("set socket.id for presence user:", msg.id)
    } else {
      console.log("unknown message format.");
    }
  })
});

server.listen(port, async () => {
  await getFinesseUsers();

  webex = Webex.init({
    credentials: {
      access_token: process.env.WEBEX_ACCESS_TOKEN
    }
  });
  console.log("Webex Initialied.")
  
  webex.once("ready", async() => {
    console.log(`Webex OBJ ready ${webex.version}`);
  
    webex.internal.device.register().then(() => {
      console.info(`Meetings:index#register --> INFO, Device registered ${webex.internal.device.url}`)
    }).then(() => {
      webex.internal.mercury.connect();
    }).then(async() => {
      let me = await webex.people.get("me");
      console.log(me);
      webex.internal.mercury.on('event:apheleia.subscription_update', async (event) => {
        if(subscribedHash[event.data.subject]) {
          console.log('event.data:', event.data);
          await syncUserPresence(event.data);
        }
      });
      for(let user of subscribeUsers){
        subscribePresenceInitial(user);
      }
    })
  });
  console.log(`listening on ${port}`);
});
