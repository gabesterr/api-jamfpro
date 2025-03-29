#!/bin/zsh

# thanks to several folks on the internet whose work helped me:
# Daniel on the MacAdmins Slack - https://macadmins.slack.com/team/UFPU7CGJF
# A little inspiration from SUPER using API role to get MDM updates
# More inspiration from this thread to get the right permissions for the API Role
# https://macadmins.slack.com/archives/C0EP2SNJX/p1728996774390989

url="https://<YOURCLOUDJSSHERE>.jamfcloud.com"

if [ -z "${4}" ]; then				#Parameter 4 client id string
	client_id="INVALID"
else
	client_id="${4}"
fi

if [ -z "${5}" ]; then				#Parameter 5 client secret string
	client_secret="NOSECRET"
else
	client_secret="${5}"
fi

if [ -z "${6}" ]; then				#Parameter 6 allow wipe
	allow_wipe="false"
else
	allow_wipe="${6}"
fi

if [ -z "${7}" ]; then				#Parameter 7 wipe different device... VERY DANGEROUS!!
	DEVICE_TO_ACTION="$(/usr/sbin/ioreg -l | /usr/bin/grep IOPlatformSerialNumber | /usr/bin/tr '"' '\n' | /usr/bin/grep -v "IOPlatform\|=\||")"
	echo $DEVICE_TO_ACTION
else
	DEVICE_TO_ACTION="${7}"
fi

if [ -z "${8}" ]; then				#Parameter 8 pin for wipe
	customPIN="111111"
else
	customPIN="${8}"
fi

# get userName for personalized prompt before device wipe. If you wanted to be really nice you'd get the Full Name for the user...
userName=$(/usr/bin/stat -f%Su /dev/console)
currentUser=$(/usr/sbin/scutil <<< "show State:/Users/ConsoleUser" | /usr/bin/awk '/Name :/ { print $3 }')
uid=$(/usr/bin/id -u "$currentUser")

# function to present user stuff...

runAsUser() {
	if [[ $currentUser != "loginwindow" ]]; then
		uid=$(/usr/bin/id -u "$currentUser")
		/bin/launchctl asuser $uid /usr/bin/sudo -u $currentUser "$@"
	else
		echo "$(/bin/date) | (i) No user logged in"
	fi
}

# changed file extensions to zip so JSS would host them as packages to cache
# upload a graphic for the dialog and a countdown video to play full screen
# get the custom icon.
if [ -e /Library/Application\ Support/JAMF/Waiting\ Room/swab.zip ]; then
	echo "renaming custom graphic swab for use and cleaning up record"
    /bin/mv /Library/Application\ Support/JAMF/Waiting\ Room/swab.zip /private/tmp/swab.png
	/bin/rm /Library/Application\ Support/JAMF/Waiting\ Room/swab.zip.cache.xml
else
	echo "custom graphic swab not found"
fi
# get the movie.
if [ -e /Library/Application\ Support/JAMF/Waiting\ Room/stalert.zip ]; then
	echo "renaming custom graphic swab for use and cleaning up record"
    /bin/mv /Library/Application\ Support/JAMF/Waiting\ Room/stalert.zip /private/tmp/stalert.mov
	/bin/rm /Library/Application\ Support/JAMF/Waiting\ Room/stalert.zip.cache.xml
else
	echo "custom video not found"
fi



# should also check that the proper tokens are in place for successful wipe... 

getAccessToken() {
	response=$(curl --silent --location --request POST "${url}/api/oauth/token" \
 	 	--header "Content-Type: application/x-www-form-urlencoded" \
 		--data-urlencode "client_id=${client_id}" \
 		--data-urlencode "grant_type=client_credentials" \
 		--data-urlencode "client_secret=${client_secret}")
 	access_token=$(echo "$response" | plutil -extract access_token raw -)
 	token_expires_in=$(echo "$response" | plutil -extract expires_in raw -)
 	token_expiration_epoch=$(($current_epoch + $token_expires_in - 1))
}

checkTokenExpiration() {
 	current_epoch=$(date +%s)
    if [[ token_expiration_epoch -ge current_epoch ]]
    then
        echo "Token valid until the following epoch time: " "$token_expiration_epoch"
    else
        echo "No valid token available, getting new token"
        getAccessToken
    fi
}

invalidateToken() {
	responseCode=$(curl -w "%{http_code}" -H "Authorization: Bearer ${access_token}" $url/api/v1/auth/invalidate-token -X POST -s -o /dev/null)
	if [[ ${responseCode} == 204 ]]
	then
		echo "Token successfully invalidated"
		access_token=""
		token_expiration_epoch="0"
	elif [[ ${responseCode} == 401 ]]
	then
		echo "Token already invalid"
	else
		echo "An unknown error occurred invalidating the token"
	fi
}

SendDeviceWipeCommand() {
    /usr/bin/curl --request POST \
    --url "$url"/api/v2/mdm/commands \
    --header "Authorization: Bearer $access_token" \
    --header 'accept: application/json' \
    --header 'content-type: application/json' \
    --data '
    {
    "clientData": [
    {
    "managementId": "'$managementID'"
    }
    ],
    "commandData": {
    "commandType": "ERASE_DEVICE",
    "obliterationBehavior": "ObliterateWithWarning",
    "pin": "'$customPIN'"
    }
    }
    '
}

# MAIN SCRIPT
checkTokenExpiration
#echo "running curl -H Authorization: Bearer $access_token $url/JSSResource/$1 -X GET"
jsssearch=$(curl -H "Authorization: Bearer $access_token" $url/JSSResource/computers/match/$DEVICE_TO_ACTION -X GET)
deviceID=$(echo "$jsssearch" | tr '<' '\n' | /usr/bin/grep "id>" | /usr/bin/grep -v udid | /usr/bin/tr '>' '\n' | /usr/bin/grep -v "id")
#echo $jsssearch
#jssdeviceinfo=$(curl -H "Authorization: Bearer $access_token" $url/JSSResource/computers/id/$deviceID -X GET)
jssdeviceinfo=$(curl -H "Authorization: Bearer $access_token" "$url/api/v1/computers-inventory/$deviceID?section=GENERAL" -X 'GET')
#managementID=$(echo "$jssdeviceinfo" | tr '<' '\n' | grep "udid>" | tr '>' '\n' | grep -v "udid")
managementID=$(echo "$jssdeviceinfo" | /usr/bin/grep "managementId" | /usr/bin/cut -d: -f2 | /usr/bin/tr -d '",' | /usr/bin/tr -d "[:space:]")
# following line just to confirm we have the right device... this script will be problematic if there can be multiple results...
echo "SendDeviceWipeCommand to ($deviceID) $DEVICE_TO_ACTION - $managementID"
# use this image? https://media.jamf.com/images/news/macos-monerase-all-content-and-settings.jpg
# curl -L -C - "https://media.jamf.com/images/news/macos-monerase-all-content-and-settings.jpg" -o /tmp/swab.jpg
# brandingFile="/Users/$userName/Library/Application Support/com.jamfsoftware.selfservice.mac/Documents/Images/brandingimage.png"
brandingFile=/tmp/swab.png 
dialogContent="get text returned of (display dialog \"WARNING: selecting WIPE will erase all user data on your Mac "$DEVICE_TO_ACTION" Are you sure, "$userName"? If so, type \n ERASE \n in the field below then click the WIPE button. This is your final warning.\" default answer \"\" with icon POSIX file \"$brandingFile\" buttons {\"Cancel\", \"WIPE\"} default button \"Cancel\")"
ACTION_WORD=$(/usr/bin/osascript -e "${dialogContent}")


# requiring both ACTION_WORD AND clicking WIPE button AND having a test mode prevents accidental wipes... 
if [[ "${ACTION_WORD}" == "ERASE" ]] ; then
	echo "${ACTION_WORD} was verified for ($deviceID) wipe status ${allow_wipe}"
    
    runAsUser /usr/bin/osascript -e 'tell application "QuickTime Player" to activate' \
		-e 'tell application "QuickTime Player" to open file "Macintosh HD:tmp:stalert.mov"' 
	/bin/sleep 1
	runAsUser /usr/bin/osascript -e 'tell application "QuickTime Player" to set looping of document "stalert.mov" to true' 
	#/bin/sleep 1
	runAsUser /usr/bin/osascript -e 'tell application "QuickTime Player" to present document "stalert.mov"' \
		-e 'tell application "QuickTime Player" to play front document'
        
	counter=10
	runAsUser /usr/bin/say "This Mac $DEVICE_TO_ACTION will be wiped in $counter seconds"
	((counter--))
    while [ $counter -gt 5 ]
    do
    runAsUser /usr/bin/say "$counter"
    ((counter--))
    done 
    if [[ "${allow_wipe}" == "true" ]] ; then
		echo "sending wipe command to ($deviceID) $DEVICE_TO_ACTION ..." 
        SendDeviceWipeCommand
		echo "WIPE SENT to ($deviceID) $DEVICE_TO_ACTION !!!" 
	else
		echo "testing mode NO wipe command sent to ($deviceID) $DEVICE_TO_ACTION ..." 
	fi
    while [ $counter -gt 2 ]
    do
    	runAsUser /usr/bin/say "$counter"
    	((counter--))
    done 
    runAsUser /usr/bin/say "Wipe imminent in $counter seconds... "
    ((counter--))
	runAsUser /usr/bin/say "$counter second. Goodbye!"
else 
	echo "Did not ERASE ($deviceID) $DEVICE_TO_ACTION"
fi
