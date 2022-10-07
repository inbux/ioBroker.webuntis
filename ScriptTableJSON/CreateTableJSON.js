// HERE YOU CAN SETUP SOME THING
// datapoints are created at start, if needed
let datapoint0 = "0_userdata.0.Stundenplan__0"; //  using instance webuntis.0.*
let datapoint1 = "0_userdata.0.Stundenplan__1"; //  using instance webuntis.1.* leave blank if you have only 1 instance of webuntis running

let NextDaysAlsoInTable = true; // true =  actual day and next day in one table, false = only actual day in table

let refreshInterval = 30; // minutes  -  used for schedule, valid values (5 - 59)

let useRowColors = true; // use colorized table rows
let rowColor1 = "#00000070"; // you can also use transparent" for any color
let rowColor2 = "#31313170";
let exceptionColor = "#e2010170";
let daySeparatorColor = "#001b74ff";
let daySeparatorHeight = "2px";

// -----------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------
// private variables following...
// DO NOT EDIT !!!!!

const tableJSON = new Array(2); // using 2 arrays because functions will be async to read and write tables for 2 instances

// -----------------------------------------------------------------------------------------
function createEntries(instance, id) {
  let prefix = "";
  let suffix = "";

  // get the data from webuntis instance
  // you can change this part, if you want to use other data
  let starttime = formatDate(getState(id + ".startTime").val, "W hh:mm");
  let endtime = formatDate(getState(id + ".endTime").val, "hh:mm");
  let teacher = getState(id + ".teacher").val;
  let room = getState(id + ".room").val;
  let subject = getState(id + ".name").val;
  let code = getState(id + ".code").val;
  // reading the new states, with extra check because they do not exists in standard webuntis adapter
  let orgteacher = existsState(id + ".orgteacher") ? getState(id + ".orgteacher").val : null;
  let orgroom = existsState(id + ".orgroom") ? getState(id + ".orgroom").val : null;

  // add old teacher or old room to text, if not null
  if (orgteacher != null) teacher += "&nbsp&nbsp<s>" + orgteacher + "</s>";
  if (orgroom != null) room += "&nbsp&nbsp<s>" + orgroom + "</s>";

  // add background color, if needed
  if (code != "regular") {
    prefix = `<div style="background: ${exceptionColor}">`;
    suffix = "</div>";
  } else if (useRowColors) {
    suffix = "</div>";
    if (tableJSON[instance].length % 2) prefix = `<div style="background: ${rowColor1}">`;
    else prefix = `<div style="background: ${rowColor2}">`;
  }

  // store date in object - these are the cols of the table
  // change order or remove if you need
  let entry = {
    start: starttime,
    end: endtime,
    subject: subject,
    teacher: teacher,
    room: room,
  };

  // add HTML background to all elements of object, if set
  if (prefix != "") {
    Object.keys(entry).forEach((key) => {
      entry[key] = prefix + entry[key] + suffix;
    });
  }

  // add object to table
  tableJSON[instance].push(entry);
}
// -----------------------------------------------------------------------------------------
function addSeparator(instance) {
  let entry = {
    start: "",
    end: "",
    subject: "",
    teacher: "",
    room: "",
  };

  let suffix = "</div>";
  let prefix = `<div style="height: ${daySeparatorHeight};background: ${daySeparatorColor}">`;

  Object.keys(entry).forEach((key) => {
    entry[key] = prefix + entry[key] + suffix;
  });

  // add object to table
  tableJSON[instance].push(entry);
}
// -----------------------------------------------------------------------------------------
function createTableJSON() {
  let datapoint = [datapoint0];

  // more than one instance defined ?
  if (datapoint1 && datapoint1 != "") datapoint.push(datapoint1);

  // looping all instances
  for (let instance = 0; instance < datapoint.length; instance++) {
    tableJSON[instance] = [];

    // get all ids from selected webuntis instance (actual day)
    $(`webuntis.${instance}.0.*.startTime`).each(function (id, i) {
      createEntries(instance, id.replace(".startTime", ""));
    });

    if (NextDaysAlsoInTable) {
      addSeparator(instance);
      // get all ids from selected webuntis instance (next day)
      $(`webuntis.${instance}.1.*.startTime`).each(function (id, i) {
        createEntries(instance, id.replace(".startTime", ""));
      });
    }
    //console.log(tableJSON[instance]);

    // store table in datapoint of instance
    setState(datapoint[instance], JSON.stringify(tableJSON[instance]));
  }
}

// -----------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------
// -----------------------------------------------------------------------------------------

// set up schedule
schedule(`*/${refreshInterval} * * * * `, function () {
  createTableJSON();
});

createState(datapoint0, {
  read: true,
  write: true,
  name: "Timetable 0 JSON",
  type: "json",
});

if (datapoint1 != "")
  createState(datapoint1, {
    read: true,
    write: true,
    name: "Timetable 1 JSON",
    type: "json",
  });

// wait here some time for creation of datapoint before parsing data
let timeoutStartdelay = setTimeout(function () {
  createTableJSON();
}, 1500);
