var currently_editing_file = false;

//These functions will be run when certain buttons are clicked
$(document).ready(function() {

	$(document).on("click", 'button#saveFile', function() {  //So this means an edited file needs to be saved
		if (!currently_editing_file) {
			var warning = document.createElement('div');
			warning.className = "warningMessage";
			$(warning).text("No file currently being edited");
			$('#warningMessagesContainer').html(warning);
		} else {
			var path = get_file_path();
			alert(path);
			submit(path);
		}
	});
	
	
	$(document).on("click", 'div#project-name', function(){
		location.reload();
	});
	
	$('#dropSearchString').keypress(function(e){
		if(e.which==13){
			e.preventDefault();
			return false;
		}
	});
	
	$(document).on("click", 'div#login', function(){
		window.location.replace('validate');
	});
	
	

});
