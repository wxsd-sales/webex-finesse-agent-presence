# Webex Finesse Agent Presence Sync Gadget

Finesse gadget that automatically sets an Agent's status to match their Webex Presence.

## Demo
[![Vidcast Overview](https://github.com/wxsd-sales/custom-pmr-pin/assets/19175490/4861e7cd-7478-49cf-bada-223b30810691)](https://app.vidcast.io/share/62f0cf80-1f45-4984-9649-06fb3ddea1b3)



## Getting Started

- Clone this repository:
 - ```git clone https://github.com/wxsd-sales/webex-finesse-agent-presence.git```

You will probably want to deploy this to a webserver when going live.

- [Create a Webex Bot Token](https://developer.webex.com/docs/bots)
- Developed with node v21.5


## Installation

### 1. Setting up the .env file
- a. Inside this project's root folder, rename the file ```.env.example``` to ```.env```
- b. In a text editor, open the ```.env```
- c. Choose a ```PORT``` or use ```PORT=5000``` if you are not sure what to use.
- d. Paste the Webex Bot Token you created from the *Getting Started* section.
- e. To run this application in Gadget mode (recommended), you can **stop here and proceed to step 2**.
- e. This application can be run completely on the server side without a gadget, with some caveats:
  - A ```FINESSE_ADMIN_TOKEN``` and ```FINESSE_SUPERVISOR_TOKEN``` are required in the .env.
    - These are both Basic Auth tokens (username:password + encoding)
  - ```GADGET_MODE``` would need to be set to false
  - When running outside of gadget mode, an agent's status would only be READY and "Supervisor Initiated" NOT_READY. This is because a Supervisor cannot set an Agent to a specific NOT_READY status.
  

### 2.a. Running the widget webserver as a container (Docker) (recommended)

- If you prefer to run this through ```npm```, skip this step and proceed to 2.b.
- Otherwise, run the following commands from the terminal inside your project's root directory:
- `docker build -t agent-presence .`
- `docker run -p 5000:5000 -i -t agent-presence`
  - replace `5000` in both places with the ```PORT``` used in your `.env` file.  

### 2.b. Running the widget webserver (npm)
_Node.js version 21.5 was used to develop this application._

- It is recommended that you run this as a container (step 2.a.).
- If you do not wish to run the webserver as a container (Docker), proceed with this step:
- Inside this project on your terminal type: `npm install`
- Then inside this project on your terminal type: `npm start`
- This should run the app on your ```PORT``` (from .env file)


### 3. Wire Up the Gadget to the Agent Layout (Only is using the recommended Gadget Mode, GADGET_MODE=true):

- You must replace the HOSTNAME on line 43 of the **public/WebexPresenceConnector_1.xml** file with your correct server endpoint. For example:
  - HOSTNAME="https://your.webserver.com"

- Login to Unified Contact Center Enterprise Management and create Reason Labels with the following names:
  - Webex DND
  - Webex Meeting
  - Webex Call
  - Webex Unavailable
- Login to your Cisco Finesse Administration Portal and edit the Desktop Layout. You will likely do this through the Team Resources tab and not the Desktop Layout tab.
  - Edit the Agent's Home view, by adding a gadget that looks like this example:
  - ```<gadget id="embeddedPresence">https://your.webserver.com/WebexPresenceConnector_1.xml</gadget>```
- Log in to your agent desktop to view the new layout.

**Additional Improvements:**

- You can modify the gadget as required.
- Finesse server caches all gadget XML and JS files, so changes made to your web server may not reflect in Finesse without a restart.
- To avoid this constraint, this project loads our JS dynamically and you should make all changes to the WebexPresenceConnector.js file going forward.
- Aside from the HOSTNAME, you should not need to make any changes to the WebexPresenceConnector_1.xml file. If you do, you will need to restart Finesse Server.

## License

All contents are licensed under the MIT license. Please see [license](LICENSE) for details.

## Disclaimer

<!-- Keep the following here -->  
Everything included is for demo and Proof of Concept purposes only. Use of the site is solely at your own risk. This site may contain links to third party content, which we do not warrant, endorse, or assume liability for. These demos are for Cisco Webex usecases, but are not Official Cisco Webex Branded demos.
 
 
## Support

Please contact the Webex SD team at [wxsd@external.cisco.com](mailto:wxsd@external.cisco.com?subject=WebexFinesseAgentPresenceGadget) for questions. Or for Cisco internal, reach out to us on Webex App via our bot globalexpert@webex.bot & choose "Engagement Type: API/SDK Proof of Concept Integration Development". 
