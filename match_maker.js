#!/usr/bin/env node
var fs = require('fs');
const { parse } = require('csv-parse/sync');
const { exit } = require('process');


const INPUT_FILE_NAME='input_file.csv'; //XXX put you file name here
const OUTPUT_FILE_NAME='output.txt'; //XXX put you file name here
const STATE_FILE_NAME='state.txt';

function LOG(input){console.log(input)}; //XXX change this to avoid verbose logging

function dump_output(file, output){
    fs.writeFileSync(file, JSON.stringify(output, null,"\r"));
}

function has_mandatory_properties(participant)
{
    const MANDATORY_PROPERTIES = ['dating males', 'dating females', 'Gender', 'Name', 'Weight', 'MaxMatches'];
    var missing_property = null;
    LOG("cheching mandatory properties for participant " + participant.Name);
    MANDATORY_PROPERTIES.some(p => {
        if (!participant.hasOwnProperty(p)){
            missing_property = p; 
            return true} 
        return false;});

    if (missing_property != null){
        LOG("Failed loading file, Mandatory field " + missing_property + " is missing");
        return false;
    }
    
    return true;
}
//Getting two indexes for participants and checking if the match is allowed
//returns reason (string) if there is a problem or null if match is allowed.
function is_match_allowed(ia, ib)
{
	LOG("checking match of: " + participants[ia].Name + " with " + participants[ib].Name);
	if (participants[ia].Name == participants[ib].Name)
		return "self";

	if (participants[ia]['dating males'] == 'block' && participants[ib].Gender == 'M' || participants[ia]['dating females'] == 'block' && participants[ib].Gender == 'F' || participants[ib]['dating males'] == 'block' && participants[ia].Gender == 'M' || 
		participants[ib]['dating females'] == 'block' && participants[ia].Gender == 'F' )
		return "gender";
		
	LOG("  A decision about B: " +  (participants[ia][participants[ib].Name] || "empty"));
	LOG("  B decision about A: " +  (participants[ib][participants[ia].Name] || "empty"));
	if (participants[ia][participants[ib].Name]=='block' || participants[ib][participants[ia].Name]=='block')
    return "block";
    
  if (participants[ia].mcount >= participants[ia].MaxMatches || participants[ib].mcount >= participants[ib].MaxMatches)
    return "maxMatches";

	return null;
}

//build candidates list according to allowed candidates with the lowest number of matches
//   check(p) - checks if the participant at index 'p' is allowed, returns true if allowed, false otherwise
function build_candidates_list(check)
{
//find the lowest number of matches 
var lowest_matches=participants.length; //starting with large number 
for (var i=0; i<participants.length; i++)
{
    var checkRes = check(i);
  LOG("Result of participant: " + participants[i].Name + " is: "  + checkRes + " mcount is: " + participants[i].mcount);
  if (checkRes && participants[i].mcount < lowest_matches)
    lowest_matches = participants[i].mcount;
}
LOG("Collecting participants with " + lowest_matches + " mathches");
var list = [];
for (var i=0; i<participants.length; i++)
  if (check(i) && participants[i].mcount == lowest_matches)
    list.push(i);

if (list.length >0) 
    LOG("Found: " + list);
else
    LOG("No candidates found");

return list;

}

//returns random index to array 'array'
function random_index(a)
{
return Math.floor(Math.random() * a.length);
}

function match(ia, ib)
{
  participants[ia][participants[ib].Name] = 'Match';
  participants[ib][participants[ia].Name] = 'Match';
  participants[ia].mcount+=parseInt(participants[ib].Weight);
  participants[ib].mcount+=parseInt(participants[ia].Weight);
}

/* MAIN FLOW */
/* ========= */

/* STEP 1 - Reading participants file */
LOG('Reading file contents');
var file_contents = fs.readFileSync(INPUT_FILE_NAME, 'utf8').trimStart();
var participants = parse(file_contents, {columns: true});
LOG('Input file:');
LOG(participants);
//Input validation
//TODO
if (participants.some(p => !has_mandatory_properties(p))){
    process.exit(1);
}
  //check "Name" column 
  //check "dating males" column
  //check "dating females" column
  //check each
    //check valid name (non empty)
    //Gender must be 'F' or 'M'


/* STEP 2 - Initializing participants data */ 
for (var i=0; i<participants.length; i++)
{
	participants[i].mcount=0; //Matches count
}

//Calculate number of constraints per participants
//TODO: the check_match should be a function
for (var i=0; i<participants.length; i++)
{
  participants[i].ccount = 0;  

  for (var j=0; j<participants.length; j++)
  {
 	var reason = is_match_allowed(i, j);
	if (reason) 
	{
 		LOG("  Match failed, reason: " + reason);
		participants[i].ccount++;
	}
	else
		LOG("  Match allowed");

  }

  LOG("Participant " + participants[i].Name + " has " + participants[i].ccount + " constraints");
}

//sort participants according to number of constraints
LOG("");
LOG("Sorting Participants according to constraints");
participants.sort(function(a,b){ return b.ccount - a.ccount});
for(var i=0; i<participants.length; i++)
  LOG("  " + participants[i].Name + ", " + participants[i].ccount);

//Set match for each participant
fs.writeFileSync(OUTPUT_FILE_NAME,  "Matching Results\n");
fs.appendFileSync(OUTPUT_FILE_NAME, "================\n");
for(var i=0; i<participants.length; i++)
{
  //If this participant already have at least one match, no need to add.
  if (participants[i].mcount > 0)
  {
    LOG("Skipping match for " + participants[i].Name + " since he already have " + participants[i].mcount + " matches");
    continue;
  }

  LOG("Looking for a match for participant: " + participants[i].Name);  
  //build candidates list for match 
  var clist=build_candidates_list(function(p){return is_match_allowed(i, p) ? false : true;});
  
  if (clist.length == 0)
  {
    LOG("ERROR: failed to find available match for " + participants[i].Name);
    LOG("dumping last state to " + STATE_FILE_NAME);
    dump_output(STATE_FILE_NAME, participants);
    return;
  } 
  //find random match
  var m=random_index(clist);
  LOG("Random_index is: " + m);
  console.log("MATCH FOUND: matching " + participants[i].Name + " with " + participants[clist[m]].Name); 
  fs.appendFileSync(OUTPUT_FILE_NAME, "matching " + participants[i].Name + " with " + participants[clist[m]].Name + '\n');


  match(i, clist[m]);
  //If this participant got a match that doesn't count (weight=0), re-run this line 
  if (participants[clist[m]].Weight == '0') 
    i--;
}

LOG("SUCCESS!")
LOG("game results are at: "+ OUTPUT_FILE_NAME);
LOG("last state is at: " + STATE_FILE_NAME);
dump_output(STATE_FILE_NAME, participants);


