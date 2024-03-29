/* Usage: Paste text of devicemanagement.gs into a new Google App Script */
/* Then reload the associated sheet and use the JSSAPI menu, for example select a list of hostnames in a column and run the menu function 'Search for Computer Info from Hostnames' */
/* In the column to the right of the hostnames you can define information you want to return such as mac_address, serial_number, username, email, udid */
/* Full list of 19 computer values for computer results is at the end of this script or viewable in the XML return of any computer search */
/* Credit where due: too many stackoverflow threads to track, MS B!nGPT for some cleanup and the mux cell parameters */
/* Developed by Gabriel Sterritt gabesterr@users.noreply.github.com aka gabester on Mac Admins Slack */
/* Implementation: Replace yourjss with your actual tenant name if using Jamf Cloud OR remove TENANTNAME and enter your on prem JSS for API_DEF and API_URL */
const TENANTNAME = 'yourjss'; 
const API_DEF = 'https://'+TENANTNAME+'.jamfcloud.com/api/v1/';       // if on-prem subsistute your full API URL here
const API_URL = 'https://'+TENANTNAME+'.jamfcloud.com/JSSResource/'; // if on-prem subsistute your full API URL here
const APISPEC = 'tokensheet' // name of the sheet where your API Token is stored
const APICELL = 'A1'; // cell on the sheet where your API token is stored
const APITYPE = 'computers' // eventually improved this enough to be used for multiple API methods e.g. computers, devices, users, sites.
/* to get temp API token open Terminal and run the next line without the comments */
/* curl -s -u "user:pass" "https://yourjss.jamfcloud.com/api/v1/auth/token" -X POST */
/* select and paste the value returned for token in the APICELL you indicated */
/* you may also want to note the token expiration time (indicated in UMT, e.g "London" */
/* These constants are defined to save additional complex calls via checkAndPromptValue and other functions */

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('JSSAPI')
    .addItem('Get Group Members', 'getGroupInfo')
    .addItem('Search for Computer Info from Hostnames','computerAPICall')
    .addItem('Get full Info from id','getComputerfromID')
    //.addItem('Get full Info from id','callAPIFullInfo')
    .addSeparator()
    .addItem('Get Info from Search List','multiCellAPICall')
    .addSeparator()
    .addItem('Check Connection', 'checkAPIOperation')
    .addItem('Get Reports', 'getJSSReports')
    //.addSeparator()
    //.addItem('Create Group (experimental)', 'makeJSSGroup')
    .addToUi();  
}

function searchInfoforValue(searchInfo, searchValue) {
 var sessionToken = checkAndPromptValue(APISPEC, APICELL)
 var authHeader = 'Bearer ' + sessionToken;
 var options = { method : 'get', headers: {Authorization: authHeader}   }
 var response = UrlFetchApp.fetch(API_URL+APITYPE+'/match/'+searchInfo, options);
 if (!response.getResponseCode()) {
   SpreadsheetApp.getUi().alert('Could not get current item '+searchInfo);
 } else { searchResultText = response.getContentText(); }  
return searchResultText;                }   // end function searchKeywithType calls checkAndPromptValue

function callAPIFullInfo() {
 var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
 var range = sheet.getActiveRange();
 // Extend the range to include the adjacent column
 var extendedRange = sheet.getRange(range.getRow(), range.getColumn(), range.getNumRows(), range.getNumColumns() + 1);
 var activeSelection = extendedRange.getValues();
  for (var i = 0; i < activeSelection.length; i++) {
   var inputText1 = activeSelection[i][0].toString(); // Get the value from the first column
   var inputText2 = activeSelection[i][1].toString(); // Get the value from the second column
   // Get the cell two columns to the right of the current cell
   xmlData=searchInfoforValue(inputText1, inputText2)
   var adjacentCell = sheet.getRange(range.getRow() + i, range.getColumn() + 2);
   adjacentCell.setValue(xmlData);
  // now process that XML Data
if (!xmlData.includes("<size>0</size></computers>")) {  // ADD VALIDATION if size > 1
var document = XmlService.parse(xmlData);
var root = document.getRootElement();
Logger.log('Root Element Name: ' + root.getName());
//var mySize = root.getChild('size');
//  SpreadsheetApp.getUi()
//  .alert('Root Size: ' + mySize);
// if ( mySize > 0 ) { 
// Get the values
//var computerElement = root.getChild('computers').getChild('computer');
var computerElement = root.getChild('computer');
var myValue = computerElement.getChild(inputText2).getText();
// check myValue is not null if so give it a value
if ( myValue === "" ) { myValue = "VALUENOTFOUND" } 
} else { myValue = "NOTINJAMFPRO" }  // if no XML was found
var adjacentCell2 = sheet.getRange(range.getRow() + i, range.getColumn() + 3);
  adjacentCell2.setValue(myValue);
}                                         } // end function callAPIFullInfo

function getJSSReports() { // a dummy function to validate onOpen menus loaded
  SpreadsheetApp.getUi() // Or DocumentApp or FormApp.
     .alert('You clicked the last menu item getJSSReports function!');        } // end getJSSReports dummy function

function checkAPIOperation() { // a function to validate can access Jamf Pro API
  var sessionToken = checkAndPromptValue(APISPEC, APICELL)
  var authHeader = 'Bearer ' + sessionToken;
  var options = {
    method : 'get',
    headers: {Authorization: authHeader}  
  }
  var response = UrlFetchApp.fetch(API_DEF + 'jamf-pro-version', options);  
  if (!response.getResponseCode()) {
    SpreadsheetApp.getUi()
    .alert('could not access Jamf Pro API at '+API_URL);
    Logger.log(response.getContentText());
  } else {
    SpreadsheetApp.getUi()
    .alert('Jamf Pro API at '+API_URL+' is '+response.getContentText());
  }                 }                                   // end checkAPIOperation calls checkAdminPromptValue

function checkAndPromptValue(sheetName, cell) {   
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(sheetName);
  var value = sheet.getRange(cell).getValue();
  if (value === "") {
    var newValue = Browser.inputBox("NOTE: get a new token with 'curl -s -u user:pass https://yourjss.jamfcloud.com/api/v1/auth/token -X POST' ... Enter a value for "+cell+" in "+sheet+": ");
    sheet.getRange(cell).setValue(newValue);
    value = newValue
  }  
  return value                                }         // end function checkAndPromptValue

function computerAPICall() {
 var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
 var range = sheet.getActiveRange();                    // Extend the range to include the adjacent column
 var extendedRange = sheet.getRange(range.getRow(), range.getColumn(), range.getNumRows(), range.getNumColumns() + 1);
 var activeSelection = extendedRange.getValues();
  for (var i = 0; i < activeSelection.length; i++) {
   var inputText1 = activeSelection[i][0].toString();   // Get the value from the first column
   var inputText2 = activeSelection[i][1].toString();   // Get the value from the second column
   xmlData=searchInfoforValue(inputText1, inputText2)
   // Get the cell two columns to the right of the current cell
   var adjacentCell = sheet.getRange(range.getRow() + i, range.getColumn() + 2);
   adjacentCell.setValue(xmlData);                      // now process that XML Data
if (!xmlData.includes("<size>0</size></computers>")) {  // ADD VALIDATION if size > 1
var document = XmlService.parse(xmlData);
var root = document.getRootElement();
Logger.log('Root Element Name: ' + root.getName());
var computerElement = root.getChild('computer');
var myValue = computerElement.getChild(inputText2).getText();
if ( myValue === "" ) { myValue = "VALUENOTFOUND" } /*} else { SpreadsheetApp.getUi()
    .alert('Jamf Pro API parseXml result not found: '+xmlData);
    myValue = "INFONOTFOUND"  } */
//Logger.log('Child Element Name: ' + computerElement);
//  SpreadsheetApp.getUi()
//  .alert('Child Element Name: ' + computerElement);
/*var idValue = computerElement.getChild('id').getText();
var emailValue = computerElement.getChild('email_address').getText();
var positionValue = computerElement.getChild('position').getText();
var roomValue = computerElement.getChild('room').getText();
var serialNumberValue = computerElement.getChild('serial_number').getText();*/ } else { myValue = "NOTINJAMFPRO" }
var adjacentCell2 = sheet.getRange(range.getRow() + i, range.getColumn() + 3);
  adjacentCell2.setValue(myValue);
/*var adjacentCell2 = sheet.getRange(range.getRow() + i, range.getColumn() + 4);
  adjacentCell2.setValue(emailValue);
var adjacentCell2 = sheet.getRange(range.getRow() + i, range.getColumn() + 5);
  adjacentCell2.setValue(positionValue);*/
}                                         } // end function computerAPICall

function getGroupInfo(groupID) { // get info on a group specified by ID number e.g. 17
  var sessionToken = checkAndPromptValue(APISPEC, APICELL)
  var authHeader = 'Bearer ' + sessionToken;
  var options = {
  method : 'get',
  headers: {Authorization: authHeader}
  }
  var response = UrlFetchApp.fetch(API_URL+'computergroups/id/'+groupID, options);  
  if (!response.getResponseCode()) {
    SpreadsheetApp.getUi()
    .alert('could not access Jamf Pro API at '+API_URL);
    Logger.log(response.getContentText());
  } else {
    xmldata=parseXml(response.getContentText())
    SpreadsheetApp.getUi()
    .alert('Jamf Pro API at '+API_URL+' is '+xmldata);    
    //.alert('Jamf Pro API at '+API_URL+' is '+response.getContentText());
    //Logger.log(response.getContentText());
  }                                             } // end function getGroupInfo calls checkAndPromptValue parseXml

function getComputerfromID() {
  var sessionToken = checkAndPromptValue(APISPEC, APICELL)
  var authHeader = 'Bearer ' + sessionToken;
  var options = {  method : 'get', headers: {Authorization: authHeader} }
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet()
  var range = sheet.getActiveRange();
  var activeSelection = range.getValues(); 
  for (var i = 0; i < activeSelection.length; i++) {
  searchforComputer=activeSelection[i].toString();
  var response = UrlFetchApp.fetch(API_URL+'computers/id/'+searchforComputer, options);
  if (!response.getResponseCode()) {
    SpreadsheetApp.getUi().alert('Could not get current item '+searchforComputer);
  } else {
    Logger.log(response.getContentText());
    var adjacentCell = sheet.getRange(range.getRow() + i, range.getColumn() + 2);
    adjacentCell.setValue(response);
    }
  }                                     } // end function getComputerfromID calls checkAndPromptValue parseComputers

function parseComputers(xmltext) { // parses computer xml data pulled from jamf pro
  let result = [];
  let document = XmlService.parse(xmltext);
  let root = document.getRootElement();
  let computers = root.getChildren('computer');
  if (computers !== null) {
  computers.forEach(item => {
      let deviceName = item.getChild('name').getText();
      let deviceMail = item.getChild('email_address').getText();
      let deviceSerial = item.getChild('serial_number').getText();
      let deviceMAC = item.getChild('mac_address').getText();
      let deviceID = item.getChild('id').getText();
      console.log('%s { %s } [%s] %s ( %s ) ', deviceSerial, deviceMail, deviceID, deviceName, deviceMAC);
    });
  } else {
    SpreadsheetApp.getUi().alert('No "computer" element found in the XML.');
  }
  return deviceSerial;          } // end parseComputers 

function parseXml(xmltext) {  // Log the title and labels for the first page of blog posts on Google's "The Keyword" blog. https://developers.google.com/apps-script/reference/xml-service
  //let xml = xmltext
  SpreadsheetApp.getUi()
  .alert('Jamf Pro API parseXml result is: '+xmltext);    
  let document = XmlService.parse(xmltext);
  let root = document.getRootElement();
  //Logger.log(document)
  let computers = root.getChild('computers');
  let size = computers.getChild('size');
  if ( size > 0 ) { 
    let items = computers.getChildren('computer');
    items.forEach(item => {
      let deviceName = item.getChild('name').getText();
      //let categories = item.getChildren('serial_number');
      //let labels = categories.map(category => category.getText());
      let deviceSerial = item.getChild('serial_number').getText();
      let deviceMAC = item.getChild('mac_address').getText();
      let deviceID = item.getChild('id').getText();
      var sheet = SpreadsheetApp.getActiveSheet();
      return [deviceID,deviceName,deviceSerial,deviceMAC]
      //sheet.appendRow([deviceID,deviceName,deviceSerial,deviceMAC]);
      //console.log('%s (%s)', title, labels.join(', '));
    });
  } else {
    SpreadsheetApp.getUi()
    .alert('Jamf Pro API parseXml result is: '+xmltext);    
  }                                     } // end function parseXml

function searchKeywithType(searchKey, searchType) {
 var sessionToken = checkAndPromptValue(APISPEC, APICELL)
 var authHeader = 'Bearer ' + sessionToken;
 var options = {
 method : 'get',
 headers: {Authorization: authHeader}
 }
 var response = UrlFetchApp.fetch(API_URL+searchType+'/match/'+searchKey, options);
 if (!response.getResponseCode()) {
   SpreadsheetApp.getUi().alert('Could not get current item '+searchKey);
   //Logger.log(response.getContentText());
 } else {
   searchResultText = response.getContentText()
   SpreadsheetApp.getUi()
   .alert('Jamf Pro API search '+searchKey+' with parameter '+searchType+' is '+searchResultText);
   }  
  return searchResultText;                }   // end function searchKeywithType calls checkAndPromptValue

function multiCellAPICall() {
 var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
 var range = sheet.getActiveRange();
 // Extend the range to include the adjacent column
 var extendedRange = sheet.getRange(range.getRow(), range.getColumn(), range.getNumRows(), range.getNumColumns() + 1);
 var activeSelection = extendedRange.getValues();
  for (var i = 0; i < activeSelection.length; i++) {
   var inputText1 = activeSelection[i][0].toString(); // Get the value from the first column
   var inputText2 = activeSelection[i][1].toString(); // Get the value from the second column
   //thisSearch = searchKeywithType(inputText1, inputText2);
   // Get the cell three columns to the right of the current cell
   var adjacentCell = sheet.getRange(range.getRow() + i, range.getColumn() + 3);
   adjacentCell.setValue(searchKeywithType(inputText1, inputText2));
 }                                         } // end function multiCellAPICall

/* LIST OF COMPUTER RESULTS from SEARCH
<computers>	       <size>		         <computer>
<id>		           <name>		         <udid>		
<serial_number>    <mac_address>	   <alt_mac_address>
<asset_tag/>       <bar_code_1/>	   <bar_code_2/>	
<username/>        <realname/>	
<email/>           <email_address/>
<room/>            <position/>	
<building/>        <building_name/>
<department/>      <department_name/>

LIST OF SPECIFIC INFO SUBSETS of id for COMPUTER - e.g. yourjss.jamfcloud.com/JSSResource/computers/id/##/subset/general
general          location      purchasing
peripherals      hardware      certificates
security         software      extension_attributes
group_accounts   iphones       configuration_profiles
*/
