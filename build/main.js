"use strict";
/*
 * Created with @iobroker/create-adapter v2.0.2
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = __importStar(require("@iobroker/adapter-core"));
const webuntis_1 = __importDefault(require("webuntis"));
// Load your modules here, e.g.:
// import * as fs from "fs";
class Webuntis extends utils.Adapter {
    constructor(options = {}) {
        super({
            ...options,
            name: "webuntis",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("unload", this.onUnload.bind(this));
        this.timetableDate = new Date();
        this.class_id = 0;
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        if (this.config.baseUrl == "") {
            this.log.error("No baseUrl set");
        }
        else if (this.config.school == "") {
            this.log.error("No school set");
        }
        else {
            if (this.config.anonymous) {
                if (this.config.class == "") {
                    this.log.error("No class set");
                }
                else {
                    //Anonymous login startet
                    const untis = new webuntis_1.default.WebUntisAnonymousAuth(this.config.school, this.config.baseUrl);
                    untis
                        .login()
                        .then(async () => {
                        this.log.debug("Anonymous Login sucessfully");
                        //search class id
                        await untis
                            .getClasses()
                            .then((classes) => {
                            for (const objClass of classes) {
                                if (objClass.name == this.config.class) {
                                    this.log.debug("Class found with id:" + objClass.id);
                                    this.class_id = objClass.id;
                                }
                            }
                        })
                            .catch(async (error) => {
                            this.log.error(error);
                            this.log.error("Login WebUntis failed");
                            await this.setStateAsync("info.connection", false, true);
                        });
                        if (this.class_id > 0) {
                            // Now we can start
                            this.readDataFromWebUntis();
                        }
                        else {
                            this.log.error("Class not found");
                        }
                    })
                        .catch((err) => {
                        this.log.error(err);
                    });
                }
            }
            else {
                // Testen ob der Login funktioniert
                if (this.config.username == "") {
                    this.log.error("No username set");
                }
                else if (this.config.client_secret == "") {
                    this.log.error("No password set");
                }
                else {
                    this.log.debug("Api login started");
                    let untis;
                    // Test to login to WebUntis
                    if ((this.config.login_method == "PasswordLogin")) {
                        untis = new webuntis_1.default(this.config.school, this.config.username, this.config.client_secret, this.config.baseUrl);
                        this.log.debug("WebUntis Login mit Passwort");
                    }
                    else {
                        untis = new webuntis_1.default.WebUntisSecretAuth(this.config.school, this.config.username, this.config.client_secret, this.config.baseUrl);
                        this.log.debug("WebUntis Login mit Secret");
                    }
                    untis
                        .login()
                        .then(async () => {
                        this.log.debug("WebUntis Login erfolgreich");
                        // Now we can start
                        this.readDataFromWebUntis();
                    })
                        .catch(async (error) => {
                        this.log.error(error);
                        this.log.error("Login WebUntis failed");
                        await this.setStateAsync("info.connection", false, true);
                    });
                }
            }
        }
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            callback();
            this.clearTimeout(this.startHourScheduleTimeout);
        }
        catch (e) {
            callback();
        }
    }
    startHourSchedule() {
        if (this.startHourScheduleTimeout) {
            this.log.debug("clearing old refresh timeout");
            this.clearTimeout(this.startHourScheduleTimeout);
        }
        this.startHourScheduleTimeout = this.setTimeout(() => {
            this.log.debug("Read new data from WebUntis");
            this.startHourScheduleTimeout = null;
            this.readDataFromWebUntis();
        }, this.getMillisecondsToNextFullHour());
    }
    readDataFromWebUntis() {
        if (this.config.anonymous) {
            const untis = new webuntis_1.default.WebUntisAnonymousAuth(this.config.school, this.config.baseUrl);
            untis
                .login()
                .then(async () => {
                this.log.debug("WebUntis Anonymous Login erfolgreich");
                await this.setStateAsync("info.connection", true, true);
                //Start the loop, we have an session
                this.log.debug("Lese Timetable 0");
                untis
                    .getTimetableFor(new Date(), this.class_id, webuntis_1.default.TYPES.CLASS)
                    .then(async (timetable) => {
                    // Now we can start
                    //this.readDataFromWebUntis()
                    if (timetable.length > 0) {
                        this.log.debug("Timetable gefunden");
                        this.timetableDate = new Date(); //info timetbale is fro today
                        await this.setTimeTable(timetable, 0);
                    }
                    else {
                        //Not timetable found, search next workingday
                        this.log.info("No timetable Today, search next working day");
                        this.timetableDate = this.getNextWorkDay(new Date());
                        await untis
                            .getTimetableFor(this.timetableDate, this.class_id, webuntis_1.default.TYPES.CLASS)
                            .then(async (timetable) => {
                            this.log.info("Timetable found on next workind day");
                            await this.setTimeTable(timetable, 0);
                        })
                            .catch(async (error) => {
                            this.log.error("Cannot read Timetable data from 0 - possible block by scool");
                            this.log.debug(error);
                        });
                    }
                    //Next day
                    this.log.debug("Lese Timetable +1");
                    this.timetableDate.setDate(this.timetableDate.getDate() + 1);
                    untis
                        .getTimetableFor(this.timetableDate, this.class_id, webuntis_1.default.TYPES.CLASS)
                        .then(async (timetable) => {
                        await this.setTimeTable(timetable, 1);
                    })
                        .catch(async (error) => {
                        this.log.error("Cannot read Timetable data from +1 - possible block by scool");
                        this.log.debug(error);
                    });
                });
            })
                .catch(async (error) => {
                this.log.error(error);
                this.log.error("Login Anonymous WebUntis failed");
                await this.setStateAsync("info.connection", false, true);
            });
        }
        else {
            let untis;
            // Test to login to WebUntis
            if ((this.config.login_method == "PasswordLogin")) {
                untis = new webuntis_1.default(this.config.school, this.config.username, this.config.client_secret, this.config.baseUrl);
                this.log.debug("WebUntis Login mit Passwort");
            }
            else {
                untis = new webuntis_1.default.WebUntisSecretAuth(this.config.school, this.config.username, this.config.client_secret, this.config.baseUrl);
                this.log.debug("WebUntis Login mit Secret");
            }
            untis
                .login()
                .then(async () => {
                this.log.debug("WebUntis Login erfolgreich");
                await this.setStateAsync("info.connection", true, true);
                this.timetableDate = new Date(); //info timetbale is for today
                //Start the loop, we have an session
                this.log.debug("Lese Timetable 0");
                untis
                    .getOwnTimetableFor(this.timetableDate)
                    .then(async (timetable) => {
                    if (timetable.length > 0) {
                        this.log.debug("Timetable gefunden");
                        await this.setTimeTable(timetable, 0);
                    }
                    else {
                        //Not timetable found, search next workingday
                        this.log.info("No timetable Today, search next working day");
                        this.timetableDate = this.getNextWorkDay(new Date());
                        await untis
                            .getOwnTimetableFor(this.timetableDate)
                            .then(async (timetable) => {
                            this.log.info("Timetable found on next workind day");
                            await this.setTimeTable(timetable, 0);
                        })
                            .catch(async (error) => {
                            this.log.error("Cannot read Timetable data from 0 - possible block by scool");
                            this.log.debug(error);
                        });
                    }
                    //Next day
                    this.log.debug("Lese Timetable +1");
                    this.timetableDate.setDate(this.timetableDate.getDate() + 1);
                    untis
                        .getOwnTimetableFor(this.timetableDate)
                        .then(async (timetable) => {
                        await this.setTimeTable(timetable, 1);
                    })
                        .catch(async (error) => {
                        this.log.error("Cannot read Timetable data from +1 - possible block by scool");
                        this.log.debug(error);
                    });
                })
                    .catch(async (error) => {
                    this.log.error("Cannot read Timetable for today - possible block by scool");
                    this.log.debug(error);
                });
                this.log.debug("Load Message center");
                //get Messages from Center
                untis
                    .getNewsWidget(new Date())
                    .then((newsFeed) => {
                    this.log.debug("Get news feed from API");
                    this.log.debug(JSON.stringify(newsFeed));
                    this.setNewsFeed(newsFeed);
                })
                    .catch(async (error) => {
                    this.log.info("Cannot read Message Center - possible block by scool");
                    this.log.debug(error);
                });
                untis
                    .getInbox()
                    .then((messages) => {
                    this.log.debug("Get inbox from API");
                    this.log.debug(JSON.stringify(messages));
                    this.setInbox(messages);
                })
                    .catch(async (error) => {
                    this.log.info("Cannot read Inbox - possible block by scool");
                    this.log.debug(error);
                });
            })
                .catch(async (error) => {
                this.log.error(error);
                this.log.error("Login WebUntis failed");
                await this.setStateAsync("info.connection", false, true);
            });
        }
        // Next round in one Hour
        this.startHourSchedule();
    }
    //FUnktion for Inbox Data
    async setInbox(messages) {
        await this.setObjectNotExistsAsync("inbox.inbox-date", {
            type: "state",
            common: {
                name: "inbox-date",
                role: "value",
                type: "string",
                write: false,
                read: true,
            },
            native: {},
        }).catch((error) => {
            this.log.error(error);
        });
        await this.setStateAsync("inbox.inbox-date", new Date().toString(), true);
        let index = 0;
        for (const message of messages.incomingMessages) {
            await this.setObjectNotExistsAsync("inbox." + index + ".subject", {
                type: "state",
                common: {
                    name: "subject",
                    role: "value",
                    type: "string",
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            await this.setStateAsync("inbox." + index + ".subject", message.subject, true);
            await this.setObjectNotExistsAsync("inbox." + index + ".contentPreview", {
                type: "state",
                common: {
                    name: "contentPreview",
                    role: "value",
                    type: "string",
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            await this.setStateAsync("inbox." + index + ".contentPreview", message.contentPreview, true);
            //Count Element
            index = index + 1;
        }
        this.deleteOldInboxObject(index);
    }
    //Function for Newsfeed
    async setNewsFeed(newsFeed) {
        await this.setObjectNotExistsAsync("newsfeed.newsfeed-date", {
            type: "state",
            common: {
                name: "newsfeed-date",
                role: "value",
                type: "string",
                write: false,
                read: true,
            },
            native: {},
        }).catch((error) => {
            this.log.error(error);
        });
        await this.setStateAsync("newsfeed.newsfeed-date", new Date().toString(), true);
        let index = 0;
        for (const feed of newsFeed.messagesOfDay) {
            await this.setObjectNotExistsAsync("newsfeed." + index + ".subject", {
                type: "state",
                common: {
                    name: "subject",
                    role: "value",
                    type: "string",
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            await this.setStateAsync("newsfeed." + index + ".subject", feed.subject, true);
            await this.setObjectNotExistsAsync("newsfeed." + index + ".text", {
                type: "state",
                common: {
                    name: "text",
                    role: "value",
                    type: "string",
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            await this.setStateAsync("newsfeed." + index + ".text", feed.text, true);
            //Count Element
            index = index + 1;
        }
        this.deleteOldNewsFeedObject(index);
    }
    //Function for Timetable
    async setTimeTable(timetable, dayindex) {
        //Info from this date is the timetable
        await this.setObjectNotExistsAsync(dayindex + ".timetable-date", {
            type: "state",
            common: {
                name: "timetable-date",
                role: "value",
                type: "string",
                write: false,
                read: true,
            },
            native: {},
        }).catch((error) => {
            this.log.error(error);
        });
        await this.setStateAsync(dayindex + ".timetable-date", this.timetableDate.toString(), true);
        let index = 0;
        let minTime = 2399;
        let maxTime = 0;
        let exceptions = false;
        //sorting for time
        timetable = timetable.sort((a, b) => a.startTime - b.startTime);
        this.log.debug(JSON.stringify(timetable));
        for (const element of timetable) {
            this.log.debug("Element found: " + index.toString());
            this.log.debug(JSON.stringify(element));
            //create an Object for each elemnt on the day
            await this.setObjectNotExistsAsync(dayindex + "." + index.toString() + ".startTime", {
                type: "state",
                common: {
                    name: "startTime",
                    role: "value",
                    type: "string",
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            await this.setStateAsync(dayindex + "." + index.toString() + ".startTime", webuntis_1.default.convertUntisTime(element.startTime, this.timetableDate).toString(), true);
            //save mintime
            if (minTime > element.startTime)
                minTime = element.startTime;
            await this.setObjectNotExistsAsync(dayindex + "." + index.toString() + ".endTime", {
                type: "state",
                common: {
                    name: "endTime",
                    role: "value",
                    type: "string",
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            await this.setStateAsync(dayindex + "." + index.toString() + ".endTime", webuntis_1.default.convertUntisTime(element.endTime, this.timetableDate).toString(), true);
            //save maxtime
            if (maxTime < element.endTime)
                maxTime = element.endTime;
            await this.setObjectNotExistsAsync(dayindex + "." + index.toString() + ".name", {
                type: "state",
                common: {
                    name: "name",
                    role: "value",
                    type: "string",
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            if (element.su && element.su.length > 0) {
                await this.setStateAsync(dayindex + "." + index.toString() + ".name", element.su[0].name, true);
            }
            else {
                await this.setStateAsync(dayindex + "." + index.toString() + ".name", null, true);
            }
            await this.setObjectNotExistsAsync(dayindex + "." + index.toString() + ".teacher", {
                type: "state",
                common: {
                    name: "teacher",
                    role: "value",
                    type: "string",
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            if (element.te && element.te.length > 0) {
                await this.setStateAsync(dayindex + "." + index.toString() + ".teacher", element.te[0].longname, true);
            }
            else {
                await this.setStateAsync(dayindex + "." + index.toString() + ".teacher", null, true);
            }
            await this.setObjectNotExistsAsync(dayindex + "." + index.toString() + ".room", {
                type: "state",
                common: {
                    name: "room",
                    role: "value",
                    type: "string",
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            if (element.ro && element.ro.length > 0) {
                await this.setStateAsync(dayindex + "." + index.toString() + ".room", element.ro[0].name, true);
            }
            else {
                await this.setStateAsync(dayindex + "." + index.toString() + ".room", null, true);
            }
            await this.setObjectNotExistsAsync(dayindex + "." + index.toString() + ".code", {
                type: "state",
                common: {
                    name: "code",
                    role: "value",
                    type: "string",
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            if (element.code == "cancelled" || element.code == "irregular") {
                this.log.debug("Exception in lesson found");
                exceptions = true;
                await this.setStateAsync(dayindex + "." + index.toString() + ".code", element.code, true);
            }
            else {
                await this.setStateAsync(dayindex + "." + index.toString() + ".code", "regular", true);
            }
            //Next Elemet
            index = index + 1;
        }
        if (index > 0) {
            //we have min one element
            await this.setObjectNotExistsAsync(dayindex + ".minTime", {
                type: "state",
                common: {
                    name: "minTime",
                    role: "value",
                    type: "string",
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            await this.setStateAsync(dayindex + ".minTime", webuntis_1.default.convertUntisTime(minTime, this.timetableDate).toString(), true);
            await this.setObjectNotExistsAsync(dayindex + ".maxTime", {
                type: "state",
                common: {
                    name: "maxTime",
                    role: "value",
                    type: "string",
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            await this.setStateAsync(dayindex + ".maxTime", webuntis_1.default.convertUntisTime(maxTime, this.timetableDate).toString(), true);
            await this.setObjectNotExistsAsync(dayindex + ".exceptions", {
                type: "state",
                common: {
                    name: "exceptions",
                    role: "value",
                    type: "boolean",
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            await this.setStateAsync(dayindex + ".exceptions", exceptions, true);
        }
        //check if an Object is over the max index
        await this.deleteOldTimetableObject(dayindex, index);
    }
    //Helpfunction
    async deleteOldInboxObject(index) {
        const delObject = await this.getObjectAsync("inbox." + index + ".subject");
        if (delObject) {
            this.log.debug("Object zum löschen gefunden - " + index.toString());
            await this.delObjectAsync(index.toString(), { recursive: true });
            // Have one delted, next round
            await this.deleteOldInboxObject(index + 1);
        }
    }
    async deleteOldNewsFeedObject(index) {
        const delObject = await this.getObjectAsync("newsfeed." + index + ".text");
        if (delObject) {
            this.log.debug("Object zum löschen gefunden - " + index.toString());
            await this.delObjectAsync(index.toString(), { recursive: true });
            // Have one delted, next round
            await this.deleteOldNewsFeedObject(index + 1);
        }
    }
    async deleteOldTimetableObject(dayindex, index) {
        this.log.debug("Object search in deleteOldTimetableObject for: " + index.toString());
        const delObject = await this.getObjectAsync(dayindex + "." + index.toString() + ".name");
        if (delObject) {
            this.log.debug("Object for deleting found: " + index.toString());
            await this.delObjectAsync(dayindex + "." + index.toString(), {
                recursive: true,
            });
            // Have one delted, next round
            await this.deleteOldTimetableObject(dayindex, index + 1);
        }
    }
    getNextWorkDay(date) {
        const d = new Date(+date);
        const day = d.getDay() || 7;
        d.setDate(d.getDate() + (day > 4 ? 8 - day : 1));
        return d;
    }
    //thanks to klein0r
    getMillisecondsToNextFullHour() {
        const now = new Date();
        const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 5, 0); // add 5 seconds to ensure we are in the next hour
        return nextHour.getTime() - now.getTime();
    }
}
if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options) => new Webuntis(options);
}
else {
    // otherwise start the instance directly
    (() => new Webuntis())();
}
//# sourceMappingURL=main.js.map