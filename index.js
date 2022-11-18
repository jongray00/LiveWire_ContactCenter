require("dotenv").config();
const parsePhoneNumber = require("libphonenumber-js");

const axios = require("axios");
const { Voice, Messaging } = require("@signalwire/realtime-api");

const PHONE_NUMBER = process.env.PHONE_NUMBER;
const AGENT_NUMBER= process.env.AGENT_NUMBER;
menu="THIS IS THE MENU.... ITEM ITEM .... PRICE PRICE"

const realtimeConfig = {
    project: process.env.PROJECT_ID,
    token: process.env.API_TOKEN,
    contexts: ["call_center"],
};

const messageClient = new Messaging.Client(realtimeConfig);
const voiceClient = new Voice.Client(realtimeConfig);

console.log("Waiting for calls...");
voiceClient.on("call.received", async (call) => {
    console.log("Got a call from", call.from, "to number", call.to);
    await call.answer();
    console.log("Inbound call answered");
    try {
        const welcome = await call.playTTS({
            text: "Hello, welcome to SignalWire Call Center room",
            gender: "male",
        });
        await welcome.waitForEnded();
        console.log("Welcome text said");

        let digits, terminator, type;

        // Prompt user to dial a digit
        const cmdPrompt = await call.promptTTS({
            text: "Please enter 1 TO speak to an agent, " +
                "2 to hear our current prices, " +
                "3 to receive a text of our pricing, " +
                "4 to send a voicemail to a member of the team",
            digits: {
                max: 1,
                digitTimeout: 15,
            },
        });
        const cmdResult = await cmdPrompt.waitForResult();
        type = cmdResult.type;
        digits = cmdResult.digits;
        terminator = cmdResult.terminator;
        console.log(
            "Prompted for digits, received digits",
            type,
            digits,
            terminator
        );

        if (digits === "1") {
            // User input 1.  We are going to dial a Washington weather
            // number and connect the call.
            await call.connectPhone({
                from: call.from,
                to: AGENT_NUMBER,
                timeout: 30,
                ringback: new Voice.Playlist().add(
                    Voice.Playlist.TTS({
                        text: "ring. ring. ring. ring. ring. ring. ring. ring",
                    })
                ),
            });
            console.log("Connecting to Agent phone ...");
            await call.waitUntilConnected();
            console.log("Connected");

        } else if (digits === "2") {
            //User input 3.  We are going to play a rain dance song hosted on our servers.
            console.log("Sending rain dance song");
            const playMenu = await call.playTTS({
                text: menu,
            });
            await playMenu.waitForEnded();
        } else if (digits === "3") {
            console.log(menu, "being sent to number", call.from);
            try {
                await messageClient.send({
                    from: PHONE_NUMBER,
                    to: call.from,
                    body: menu,
                });
            } catch (e) {
                const pb = await call.playTTS({
                    text:
                        "Sorry, I couldn't send the message." +
                        (e?.data?.from_number[0] ?? " ") +
                        " I will say the contents here. " +
                        menu,
                });
                await pb.waitForEnded();
            }
        } else if (digits === "4") {
            //User input 4.  We are going to ask for a phone number to dial and play a rain dance song to it.
            const tts = await call.playTTS({
                text: "Please leave a message with your name and number at the beep. Press the pound key when finished.",
            });
            await tts.waitForEnded();

            // Callback to be executed when the recording ends.
            call.on("recording.ended", async (rec) => {
                const tts = await call.playTTS({
                    text: "Thank you for your message. A member of our team will contact you shortly. Goodbye!",
                });
                await tts.waitForEnded();
                console.log(rec)
                console.log("Recording URL:", rec.url);
                recording_url= rec.url
                callWithVoiceMail(recording_url);
                await call.hangup();
            });

            const recording = await call.recordAudio({
                endSilenceTimeout: 0,
                terminators: "#",
            });

            // Stop the recording after 15 seconds.
            setTimeout(() => recording.stop(), 15000);

        console.log("Started.");

            } else {
                console.log("Invalid number", digits);
                let pb = await call.playTTS({
                    gender: "male",
                    text: "The number is invalid. Bye",
                });
                await pb.waitForEnded();
            }
        console.log("Hanging up");
        //await call.hangup();
    } catch (error) {
        console.error("Either call hung up by user, or some other error: ", error);
    }
});

async function callWithVoiceMail(recording_url) {
    try {
        console.log("Sending Call");
        const call = await voiceClient.dialPhone({
            from: PHONE_NUMBER,
            to: AGENT_NUMBER,
            timeout: 30,
        });
        console.log("sending rain dance song");
        const SayMenu = await call.playAudio({
            url: recording_url,
        });
        await SayMenu.waitForEnded();
        await call.hangup();
    } catch (e) {
        console.log("Call not answered.", e);
    }
}