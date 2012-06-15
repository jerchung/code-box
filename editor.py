import flask, dropbox, os

app = flask.Flask(__name__)

TOKEN_STORE = {}

#Set your own access keys using the dropbox app system
APP_KEY = ""
APP_SECRET = ""
ACCESS_TYPE = 'dropbox'

real_client = None

#This will be quite large
#use the .get method so that you can set a default value to return if there is no pertaining key.
#this dictionary is used to map the file MIME type to the mode so that the editor modes can be loaded dynamically
mime_type_dict = {'text/x-mysql': 'mysql', 'text/x-csharp': 'clike', 'text/x-java': 'clike', 'text/x-rpm-spec': 'spec', 'text/n-triples': 'ntriples', 'text/x-lua': 'lua', 
                  'text/x-rst': 'restructuredtext', 'application/json': 'javascript', 'text/x-erlang': 'erlang', 'text/x-less': 'less', 'text/x-scheme': 'scheme', 'text/x-python': 'python', 
                  'text/x-go': 'go', 'text/x-rsrc': 'r', 'application/xquery': 'xquery','text/x-sh': 'shell', 'text/x-c++src': 'clike', 'text/x-ecl': 'ecl', 'text/velocity': 'velocity', 
                  'application/x-jsp': 'htmlembedded', 'text/x-php': 'php', 'text/x-diff': 'diff', 'text/x-haskell':'haskell', 'text/x-stex': 'stex', 'text/x-stsrc': 'smalltalk', 
                  'text/x-ruby': 'ruby', 'text/x-verilog': 'verilog', 'application/x-ejs': 'htmlembedded', 'application/xml': 'htmlmixed', 'application/x-sparql-query': 'sparql', 
                  'text/x-tiddlywiki': 'tiddlywiki', 'text/x-markdown': 'markdown', 'text/x-coffeescript': 'coffeescript', 'text/x-groovy': 'groovy', 'text/x-plsql': 'pl/sql', 
                  'text/x-smarty': 'smarty', 'text/x-clojure': 'clojure', 'application/x-httpd-php': 'php', 'text/x-rustsrc': 'rust', 'text/html': 'htmlmixed', 
                  'text/javascript': 'javascript', 'text/x-pig': 'pig', 'text/x-ini': 'properties', 'text/x-pascal': 'pascal', 'text/x-rpm-changes': 'changelog', 
                  'text/x-yaml': 'yaml', 'text/vbscript': 'vbscript', 'application/x-aspx': 'htmlembedded', 'text/x-csrc': 'clike', 'text/x-properties': 'properties', 
                  'text/css': 'css', 'application/javascript': 'javascript'}

def get_session():
    return dropbox.session.DropboxSession(APP_KEY, APP_SECRET, ACCESS_TYPE)


def get_client(access_token):
    sess = get_session()
    sess.set_token(access_token.key, access_token.secret)
    return dropbox.client.DropboxClient(sess)

@app.route('/validate')
def index_page(): 
    sess = get_session() 
    request_token = sess.obtain_request_token()
    TOKEN_STORE[request_token.key] = request_token
    callback = "http://%s/callback" % (flask.request.headers['host'])
    url = sess.build_authorize_url(request_token, oauth_callback=callback)
    return flask.redirect(url)

def set_client(access_token):
    global real_client
    real_client = get_client(access_token)

@app.route('/')
def index():
    cookies = flask.request.cookies
    validated = cookies.get('session_validated')
    if validated:
        access_token_key = cookies.get('access_token_key')
        access_token = TOKEN_STORE[access_token_key]
        set_client(access_token)
        account_info = real_client.account_info()
        user_name = account_info.get("display_name", "Unknown Name")
        return flask.render_template('editor.html', user_name = user_name)
    else:
        return flask.render_template('preview.html')
    

@app.route('/callback')
def callback(oauth_token=None):
    # note: the OAuth spec calls it 'oauth_token', but it's
    # actually just a request_token_key...
    request_token_key = flask.request.args['oauth_token']
    if not request_token_key:
        return "Expected a request token key back!"
    sess = get_session()
    request_token = TOKEN_STORE[request_token_key]
    access_token = sess.obtain_access_token(request_token)
    TOKEN_STORE[access_token.key] = access_token
    resp = flask.redirect(flask.url_for('index'))
    resp.set_cookie('access_token_key', value=access_token.key)#, max_age=604800)
    resp.set_cookie('session_validated', value=True)#, max_age=604800)
    return resp

@app.route('/viewfiles/<path:path>')
@app.route('/viewfiles')
def view_files(path='.'):
    context = real_client.metadata(path)
    if context["is_dir"]:
        return flask.jsonify(data = context, isFolder = True, path = context["path"])
    else:
        file_object, metadata = real_client.get_file_and_metadata(path)
        file_text = file_object.read()
        mime_type = metadata['mime_type']
        mode = mime_type_dict.get(mime_type, "text")
        return flask.jsonify(data = file_text, isFolder = False, type= mode, path = context["path"], parent_rev = context['rev'])

@app.route('/submit/<path:path>', methods=["POST"])
def submit_file(path):
    file_path = path
    file_obj = flask.request.form["editor"]
    #rev = flask.request.form["parent_rev"] Don't use rev since that overrides the overwrite boolean
    real_client.put_file(file_path, file_obj, overwrite=True)
    return "Submitted"

@app.route('/search', methods=["POST"])
def search_file():
    print str(flask.request.values)
    search_within = flask.request.form["folder_path"]
    search_string = flask.request.form["search_string"]
    file_list = real_client.search(search_within, search_string)
    return flask.jsonify(file_list = file_list)

@app.route('/logout')
def logout():
    resp = flask.redirect(flask.url_for('index'))
    resp.set_cookie('access_token_key', value=None)
    resp.set_cookie('session_validated', value="")
    return resp


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
