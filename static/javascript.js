window.onload = function() {
	//Creating the editor for the code
	editor = CodeMirror.fromTextArea(document.getElementById("editor"), {
		lineWrapping : false,
		lineNumbers : true,
		fixedGutter : true,
		theme: "ambiance"
	});
	//Fill in first line of data
	get_data("", true);
}


var editor;
//Use this boolean to know when to discard the last element of the display path or to keep it when switching files or folders
var currently_editing_file = false;
var current_path_last; //This var will hold a reference to the last element in the current folder display path since sometimes it needs to be replaced.


//These functions will be run when certain buttons are clicked
$(document).ready(function() {
	$(document).on("click", 'div.dropboxLink', function() { //One of the links on the left is clicked, need to populate with new links
		var path = get_folder_path() + '/' + $.trim($(this).text());
		get_data(path, true);
		editor.setValue(""); //Clear editor
		$('#warningMessagesContainer').html(""); //Reset all warning messages.
	});

	$(document).on("click", 'button#saveFile', function() {  //So this means an edited file needs to be saved
		if (!currently_editing_file) {
			var warning = document.createElement('div');
			warning.className = "warningMessage";
			$(warning).text("No file currently being edited");
			$('#warningMessagesContainer').html(warning);
		} else {
			var path = get_file_path();
			submit(path);
		}
	});
	
	$(document).on("click", 'div.pathElement', function(){
		var path = $(this).data("path");
		get_data(path, false);
		set_path_display_absolute($(this));
		editor.setValue(""); //clear editor
	});
	
	$(document).on("click", 'div.iconRefresh', function(){
		refresh_menu(); //refresh left menu
	});
	
	$(document).on("click", 'div#project-name', function(){
		location.reload();
		editor.setValue("");//clear editor
	})
	
	$(document).on("click", '.search-btn', function(){
		search();
	})
	
	$('#dropSearchString').keypress(function(e){
		if(e.which==13){
			search();
			e.preventDefault();
		}
	});
	
	$(document).on("click", 'div#logout', function() {
		window.location.replace('logout');
	});
});

//takes the data from get_data and populates the relevant menus and displays with the relevant information
function set_menus(result) {
	if (result["isFolder"]) {//So the current element we're looking at is a folder'
		//Clear the editor since we're now viewing folders'
		fill_in_links(result["data"]["contents"]);
		//Use the info the server sent back to re-fill left menu with links
		$('#folder_path').val(result["path"]);
	} else {//Currently looking at a file, set the text in the editor etc. etc.
		editor.setValue(result["data"]);
		editor.setOption("mode", result["type"]);
		CodeMirror.autoLoadMode(editor, result["type"]);
		//Loads the needed mode dynamically
		$('#file_path').val(result['path']);
		//Set the hidden form holding the file path
		$('#file_rev').val(result["parent_rev"]);
		//Need to set parent_rev so that if the file is submitted it get submitted correctly
		var folder_path = remove_filename(result["path"]);
		//Removes the filename from the path
		$('#folder_path').val(folder_path);
		editor.focus(); //Focus on editor
	}
}

//need exact path for get_data
//Reset path display is a boolean which shows whehter to append something to the end of the path display or recreate
//This function also calls the functions that sets up the displays for the page since functions need to take place within the callback
function get_data(path, appendPathDisplay, clearEditor) {
	var true_url = '/viewfiles' + path;
	$.getJSON(true_url, function(result) {
		var isFile = !result["isFolder"];
		set_menus(result); //Set_menus needs to be called within the callback since otherwise the other funcctions will execute before the call back is complete
		if(appendPathDisplay){
			if (path != ""){
				append_path_display(path);
			}
		}
		if (result["isFolder"]) {
			currently_editing_file = false;
		} else {
			currently_editing_file = true;
		}
	})
	.error(function(){
		var warning = document.createElement('div');
		warning.className = "warningMessage";
		$(warning).text("Unsupported file type");
		$('#warningMessagesContainer').html(warning);
	});
}

//Returns the path in the hidden input folder_path which is updated each time a a folder or file is called
function get_folder_path() {
	
	var folder_path = $('#folder_path').val();
	if (folder_path == '/') {
		return "";
	} else {
		return folder_path;
	}
}

//Returns the path in the hidden input file_path which updates each time a file is edited
function get_file_path() {
	return $('#file_path').val();
}

//Somtimes, when calling a filename's path, we need to get the path minus the filename.  This implementation assumes'
//that there's no "/"'s except for denoting whether we're moving to a new file.
function remove_filename(path) {
	var path_list = path.split('/');
	var return_path = ""
	for (var i = 0; i < path_list.length - 1; i++) {
		return_path += '/' + path_list[i];
		//in the case that the path lookes like "/worksapce/bla/bla/bla.txt", the return list will look like [,workspace,bla,bla.txt] with an empty element in front due to the beginning slash
		//So then the final return product would looke like //workspace/bla/bla with an extra '/' in front, so we remove that with the substring starting at 1.
	}
	return return_path.substring(1);
}

//Use this function if only appending to the path display i.e. only changing the last element of the path display from moving from folder to folder or chanigng files etc.
//Uses absolute path as an argument
//Also if there is a file in the path currently, then last element gets replaced instead of appending an element to the end.
//The text of the link should be the last element of denoted by the forward slashes
//The isFile boolean is to see if the current path leads to a file.
function append_path_display(path) {
	var new_path_element = document.createElement('div');
	$(new_path_element).data("path", path);
	new_path_element.className = "pathElement divLink";
	var link_text = path.split('/').pop();
	$(new_path_element).text(link_text);
	//So this means there is a currently a filename in the path that must be replaced with the new path Element
	if (currently_editing_file) {
		$(current_path_last).replaceWith(new_path_element);
	} else { //Otherwise just append the new link to the current path display.
		$("#currentFolderPath").append(new_path_element);
	}
	current_path_last = new_path_element; //set the last element of the path display appropriately
}

//Fills in the links in the left menu by using the data gotten from get_data.  The list of folders and files contained in the folder just clicked to be specific
function fill_in_links(new_objects) {
	var folder_list = new Array();
	var file_list = new Array();
	//dict_links will be the context data, so it'll be a dictionary with the path, contents, etc.
	//Need to remove the first forward slash in the path url for the program to work correctly
	for (var i = 0; i < new_objects.length; i++) {
		var item = new_objects[i];
		var isFolder = item["is_dir"];
		var path_string = item["path"];
		var folder_or_file_name = path_string.split("/").pop(); //Last element is the folder or file name which makes up the text
		var new_li = document.createElement('li');
		var new_div = document.createElement('div');
		new_div.className = "dropboxLink divLink";
		new_div.innerHTML = folder_or_file_name;
		new_li.appendChild(new_div);
		if (isFolder) {
			folder_list.push(new_li);
		} else {
			file_list.push(new_li);
		}
	}
	$('#dropboxFolderLinks').html(folder_list);
	$('#dropboxFileLinks').html(file_list);
}

//Use this function if one of the links in the path display is clicked, so that all the links that come after it should be removed since you're going back to a previously visisted link
function set_path_display_absolute(pathElement) {
	var index = $(pathElement).index();
	//All pathElements that come after the clicked element get removed through comparison of the indexes
	//This is basically a for loop through all the elements of "current Folder Path"
	$('#currentFolderPath').children('.pathElement').each(function(){
		if ($(this).index() > index) {
			$(this).remove();
		}
	});
}

function refresh_menu(){
	var path = get_folder_path();
	get_data(path, false);
	
}

//This function saves the file being currently edited to the dropbox folder
//Needs an absolute path given
function submit(path) {
	var true_url = '/submit' + path;
	editor.save();
	var data = $('#editor-form').serialize();
	$.post(true_url, data, function(result) {
		var warning = document.createElement('div');
		warning.className = "warningMessage";
		$(warning).text("File saved successfully!");
		$('#warningMessagesContainer').html(warning);
	});
}

//This function uses the dropbox sdk search function to search within the current folder you're viewing
function search() {
	var search_string = $("#dropSearchString").val();
	var data = "folder_path=" + get_folder_path() + "&search_string=" + search_string; //Query string that will be sent to the python script
	$.post('/search', data, function(result){
		//Will call the function that will fill in left side menu here
		fill_in_links(result["file_list"]);
	});
}
