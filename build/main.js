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
        //private subjectList0: number[] = [];
        //private subjectList1: number[] = [];
        this.subjectList = [];
        this.anonymousLogin = false;
        this.loginSuccessful = false;
        this.numberOfDays = 5;
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
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
            return;
        }
        if (this.config.school == "") {
            this.log.error("No school set");
            return;
        }
        if (this.config.username == "") {
            this.anonymousLogin = true;
            this.log.info("No username set");
        }
        if (this.config.client_secret == "") {
            this.log.info("No password set");
            this.anonymousLogin = true;
        }
        if (this.config.class == "") {
            this.log.info("No class set - we would need this for anonymous login");
            if (this.anonymousLogin) {
                this.log.error("not enough data to login in - please check configuration !");
                return;
            }
        }
        else {
            //Anonymous login startet
            const untis = new webuntis_1.default.WebUntisAnonymousAuth(this.config.school, this.config.baseUrl);
            this.subscribeStates("info.refresh");
            untis
                .login()
                .then(async () => {
                this.log.info("Anonymous Login sucessful");
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
                    this.loginSuccessful = true;
                }
                else {
                    this.log.error("Class not found");
                }
            })
                .catch((err) => {
                this.log.error(err);
                this.log.error("Maybe anonymous login not supported - leave class empty to skip anonymous login");
            });
        }
        if (!this.anonymousLogin) {
            // Testen ob der Login funktioniert
            let untis;
            // Test to login to WebUntis
            if (this.config.login_method == "PasswordLogin") {
                untis = new webuntis_1.default(this.config.school, this.config.username, this.config.client_secret, this.config.baseUrl);
                this.log.info("WebUntis Login with password");
            }
            else {
                untis = new webuntis_1.default.WebUntisSecretAuth(this.config.school, this.config.username, this.config.client_secret, this.config.baseUrl);
                this.log.info("WebUntis Login with Secret");
            }
            untis
                .login()
                .then(async () => {
                this.log.info("WebUntis Login sucessful");
                // Now we can start
                this.loginSuccessful = true;
            })
                .catch(async (error) => {
                this.log.error(error);
                this.log.error("Login WebUntis failed");
                await this.setStateAsync("info.connection", false, true);
            });
        }
        this.setTimeout(() => {
            if (this.loginSuccessful)
                this.readDataFromWebUntis();
        }, 3000);
    }
    //--------------------------------------------------------------------------------------
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
            if (id.indexOf("info.refresh") != -1) {
                if (state.val == true) {
                    this.setStateAsync("info.refresh", false, true);
                    this.readDataFromWebUntis();
                }
            }
        }
        else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            callback();
            this.clearTimeout(this.startHourScheduleTimeout);
            this.clearTimeout(this.timeoutRead);
        }
        catch (e) {
            callback();
        }
    }
    // -------------------------------------------------------------------------------------------------
    startHourSchedule() {
        let msToNextTime = this.getMillisecondsToNextFullHour();
        const today = new Date().getHours();
        if (today >= 6 && today < 8) {
            // do more updates in the morning
            msToNextTime = 15 * 60 * 1000; // 15 minutes
        }
        if (this.startHourScheduleTimeout) {
            this.log.debug("clearing old refresh timeout");
            this.clearTimeout(this.startHourScheduleTimeout);
        }
        this.startHourScheduleTimeout = this.setTimeout(() => {
            this.log.debug("Read new data from WebUntis");
            this.startHourScheduleTimeout = null;
            this.readDataFromWebUntis();
        }, msToNextTime);
    }
    // -------------------------------------------------------------------------------------------------
    readAnonymousData() {
        const untis = new webuntis_1.default.WebUntisAnonymousAuth(this.config.school, this.config.baseUrl);
        untis
            .login()
            .then(async () => {
            this.log.debug("WebUntis Anonymous Login sucessful");
            await this.setStateAsync("info.connection", true, true);
            //Start the loop, we have an session
            this.log.debug("Reading Timetable 0");
            untis.getTimetableFor(new Date(), this.class_id, webuntis_1.default.TYPES.CLASS).then(async (timetable) => {
                // Now we can start
                //this.readDataFromWebUntis()
                if (timetable.length > 0) {
                    this.log.debug("Timetable found");
                    this.timetableDate = new Date(); //info timetbale is fro today
                    await this.setTimeTable(timetable, this.timetableDate, 0);
                }
                else {
                    //Not timetable found, search next workingday
                    this.log.info("No timetable Today, search next working day");
                    this.timetableDate = this.getNextWorkDay(new Date());
                    await untis
                        .getTimetableFor(this.timetableDate, this.class_id, webuntis_1.default.TYPES.CLASS)
                        .then(async (timetable) => {
                        this.log.info("Timetable found on next workind day");
                        await this.setTimeTable(timetable, this.timetableDate, 0);
                    })
                        .catch(async (error) => {
                        this.log.error("Cannot read Timetable data from 0 - possible block by school");
                        this.log.debug(error);
                    });
                }
                //Next day(s)
                for (let day = 1; day < this.numberOfDays; day++) {
                    this.log.debug("Reading Timetable +" + day);
                    const newDate = new Date();
                    newDate.setDate(this.timetableDate.getDate() + day);
                    untis
                        .getTimetableFor(newDate, this.class_id, webuntis_1.default.TYPES.CLASS)
                        .then(async (timetable) => {
                        await this.setTimeTable(timetable, newDate, day);
                    })
                        .catch(async (error) => {
                        this.log.error("Cannot read Timetable data from " + day + " - possible block by school");
                        this.log.debug(error);
                    });
                }
            });
        })
            .catch(async (error) => {
            this.log.error(error);
            this.log.error("Login Anonymous WebUntis failed");
            await this.setStateAsync("info.connection", false, true);
        });
    }
    //-------------------------------------------------------------------------------------------------
    readPersonalData() {
        let untis;
        // Test to login to WebUntis
        if (this.config.login_method == "PasswordLogin") {
            untis = new webuntis_1.default(this.config.school, this.config.username, this.config.client_secret, this.config.baseUrl);
            this.log.debug("WebUntis Login with password");
        }
        else {
            untis = new webuntis_1.default.WebUntisSecretAuth(this.config.school, this.config.username, this.config.client_secret, this.config.baseUrl);
            this.log.debug("WebUntis Login with Secret");
        }
        untis
            .login()
            .then(async () => {
            this.log.debug("WebUntis Login sucessful");
            await this.setStateAsync("info.connection", true, true);
            this.timetableDate = new Date(); //info timetbale is for today
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 3);
            //Start the loop, we have an session
            this.log.debug("Reading Timetable 0");
            untis
                .getOwnTimetableFor(this.timetableDate)
                .then(async (timetable) => {
                if (timetable.length > 0) {
                    this.log.debug("Timetable found");
                    await this.setTimeTable(timetable, this.timetableDate, 0, false);
                }
                else {
                    //Not timetable found, search next workingday
                    this.log.info("No timetable Today, search next working day");
                    this.timetableDate = this.getNextWorkDay(new Date());
                    await untis
                        .getOwnTimetableFor(this.timetableDate, false)
                        .then(async (timetable) => {
                        this.log.info("Timetable found on next workind day");
                        await this.setTimeTable(timetable, this.timetableDate, 0, false);
                    })
                        .catch(async (error) => {
                        this.log.error("Cannot read OwnTimetable data from 0 - possible block by school");
                        this.log.debug(error);
                    });
                }
                //Next day
                for (let day = 1; day < this.numberOfDays; day++) {
                    this.log.debug("Lese Timetable +" + day);
                    const newDate = new Date();
                    newDate.setDate(this.timetableDate.getDate() + day);
                    untis
                        .getOwnTimetableFor(newDate)
                        .then(async (timetable) => {
                        await this.setTimeTable(timetable, newDate, day, false);
                    })
                        .catch(async (error) => {
                        this.log.error("Cannot read OwnTimetable data from " + day + " - possible block by school");
                        this.log.debug(error);
                    });
                }
            })
                .catch(async (error) => {
                this.log.error("Cannot read OwnTimetable for today - possible block by school");
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
        // Next round in one Hour
        this.startHourSchedule();
    }
    // ----------------------------------------------------------------------------
    readDataFromWebUntis() {
        //this.subjectList0.length = 0;
        //this.subjectList1.length = 0;
        this.subjectList = [];
        try {
            this.setStateAsync("0.exceptions", false, true);
            this.setStateAsync("1.exceptions", false, true);
        }
        catch (error) { }
        // we have login data, so trying to read personal data
        if (!this.anonymousLogin) {
            this.log.debug("Reading personal data");
            this.readPersonalData();
        }
        // if we have a class, then try anonymous login to get more data
        if (this.config.class != "") {
            this.timeoutRead = this.setTimeout(() => {
                this.log.debug("Reading anonymous data");
                for (let day = 0; day < this.numberOfDays; day++)
                    this.log.debug("Subjects on day " + day.toString() + ": " + JSON.stringify(this.subjectList[day]));
                this.readAnonymousData();
            }, 15000);
        }
    }
    // ----------------------------------------------------------------------------
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
    // ----------------------------------------------------------------------------
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
    // ----------------------------------------------------------------------------
    //Function for Timetable
    async setTimeTable(timetable, timetableDate, dayindex, anonymous = true) {
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
        await this.setStateAsync(dayindex + ".timetable-date", timetableDate.toString(), true);
        let index = 0;
        let minTime = 2399;
        let maxTime = 0;
        let exceptions = false;
        let orgfound = false;
        let skipSubject = false;
        //sorting for time
        timetable = timetable.sort((a, b) => a.startTime - b.startTime);
        this.log.debug(JSON.stringify(timetable));
        // ---- looping all subjects -----------------------
        if (this.subjectList[dayindex] == undefined)
            this.subjectList[dayindex] = [];
        for (const element of timetable) {
            this.log.debug("Element found: " + index.toString());
            this.log.debug(JSON.stringify(element));
            skipSubject = false;
            // first time, get all personal subjects
            if (!anonymous) {
                this.subjectList[dayindex].push(element.id);
            }
            // second run, skip all subject that are not for us
            else {
                if (this.subjectList[dayindex][index] != element.id)
                    skipSubject = true;
            }
            if (!skipSubject || this.anonymousLogin) {
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
                await this.setStateAsync(dayindex + "." + index.toString() + ".startTime", webuntis_1.default.convertUntisTime(element.startTime, timetableDate).toString(), true);
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
                await this.setStateAsync(dayindex + "." + index.toString() + ".endTime", webuntis_1.default.convertUntisTime(element.endTime, timetableDate).toString(), true);
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
                await this.setObjectNotExistsAsync(dayindex + "." + index.toString() + ".longname", {
                    type: "state",
                    common: {
                        name: "longname",
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
                    await this.setStateAsync(dayindex + "." + index.toString() + ".longname", element.su[0].longname, true);
                }
                else {
                    if (!anonymous)
                        await this.setStateAsync(dayindex + "." + index.toString() + ".longname", null, true);
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
                await this.setObjectNotExistsAsync(dayindex + "." + index.toString() + ".orgteacher", {
                    type: "state",
                    common: {
                        name: "orgteacher",
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
                    const data = JSON.parse(JSON.stringify(element.te[0]));
                    if (data["orgname"] !== undefined) {
                        await this.setStateAsync(dayindex + "." + index.toString() + ".orgteacher", data["orgname"], true);
                        orgfound = true;
                    }
                    else
                        await this.setStateAsync(dayindex + "." + index.toString() + ".orgteacher", null, true);
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
                await this.setObjectNotExistsAsync(dayindex + "." + index.toString() + ".orgroom", {
                    type: "state",
                    common: {
                        name: "orgroom",
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
                    const data = JSON.parse(JSON.stringify(element.ro[0]));
                    if (data["orgname"] !== undefined) {
                        await this.setStateAsync(dayindex + "." + index.toString() + ".orgroom", data["orgname"], true);
                        orgfound = true;
                    }
                    else {
                        await this.setStateAsync(dayindex + "." + index.toString() + ".orgroom", null, true);
                    }
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
                    if (orgfound) {
                        this.log.debug("Exception in lesson found");
                        exceptions = true;
                        orgfound = false;
                        await this.setStateAsync(dayindex + "." + index.toString() + ".code", "irregular", true);
                    }
                    else if (anonymous || !this.anonymousLogin)
                        await this.setStateAsync(dayindex + "." + index.toString() + ".code", "regular", true);
                }
                //Next Elemet
                index = index + 1;
            }
            else
                this.log.debug("SKIPPED");
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
                await this.setStateAsync(dayindex + ".minTime", webuntis_1.default.convertUntisTime(minTime, timetableDate).toString(), true);
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
                await this.setStateAsync(dayindex + ".maxTime", webuntis_1.default.convertUntisTime(maxTime, timetableDate).toString(), true);
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
                if (anonymous || exceptions)
                    await this.setStateAsync(dayindex + ".exceptions", exceptions, true);
            }
        }
        //check if an Object is over the max index
        await this.deleteOldTimetableObject(dayindex, index);
    }
    //Helpfunction
    async deleteOldInboxObject(index) {
        const delObject = await this.getObjectAsync("inbox." + index + ".subject");
        if (delObject) {
            this.log.debug("Object for deleting found - " + index.toString());
            await this.delObjectAsync(index.toString(), { recursive: true });
            // Have one delted, next round
            await this.deleteOldInboxObject(index + 1);
        }
    }
    async deleteOldNewsFeedObject(index) {
        const delObject = await this.getObjectAsync("newsfeed." + index + ".text");
        if (delObject) {
            this.log.debug("Object for deleting found - " + index.toString());
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