package planetscale

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"time"
)

const (
	authURL  = "https://app.planetscale.com/oauth/authorize"
	tokenURL = "https://auth.planetscale.com/oauth/token"
)

// Authenticate performs the OAuth authorization-code flow for PlanetScale.
// clientID and clientSecret come from a registered PlanetScale OAuth application.
// openBrowser is called with the authorization URL and should open it in the
// system browser. Blocks until the user completes auth or 5 minutes elapse.
// callbackPort is the fixed local port for the OAuth redirect URI.
// Register http://127.0.0.1:7739/callback in your PlanetScale OAuth app.
const callbackPort = 7739

func Authenticate(clientID, clientSecret string, openBrowser func(string)) (string, error) {
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", callbackPort))
	if err != nil {
		return "", fmt.Errorf("port %d is already in use — is another sign-in in progress?", callbackPort)
	}
	redirectURI := fmt.Sprintf("http://127.0.0.1:%d/callback", callbackPort)

	codeCh := make(chan string, 1)
	errCh := make(chan error, 1)

	mux := http.NewServeMux()
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		if errParam := r.URL.Query().Get("error"); errParam != "" {
			desc := r.URL.Query().Get("error_description")
			w.Header().Set("Content-Type", "text/html")
			fmt.Fprint(w, callbackHTML("Authorization failed: "+errParam))
			errCh <- fmt.Errorf("%s: %s", errParam, desc)
			return
		}
		code := r.URL.Query().Get("code")
		if code == "" {
			errCh <- fmt.Errorf("no authorization code in callback")
			return
		}
		w.Header().Set("Content-Type", "text/html")
		fmt.Fprint(w, callbackHTML("Connected to PlanetScale — you can close this tab"))
		codeCh <- code
	})

	srv := &http.Server{Handler: mux}
	go srv.Serve(ln) //nolint:errcheck
	defer srv.Close()

	params := url.Values{
		"client_id":     {clientID},
		"redirect_uri":  {redirectURI},
		"response_type": {"code"},
	}
	scopes := "read_user%20read_organizations%20read_databases%20manage_passwords"
	openBrowser(authURL + "?" + params.Encode() + "&scope=" + scopes)

	select {
	case code := <-codeCh:
		return exchangeCode(clientID, clientSecret, code, redirectURI)
	case err := <-errCh:
		return "", err
	case <-time.After(5 * time.Minute):
		return "", fmt.Errorf("authentication timed out")
	}
}

func exchangeCode(clientID, clientSecret, code, redirectURI string) (string, error) {
	body := url.Values{
		"grant_type":    {"authorization_code"},
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"code":          {code},
		"redirect_uri":  {redirectURI},
	}
	resp, err := http.PostForm(tokenURL, body)
	if err != nil {
		return "", fmt.Errorf("token exchange: %w", err)
	}
	defer resp.Body.Close()

	var tok struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tok); err != nil {
		return "", fmt.Errorf("decoding token response: %w", err)
	}
	if tok.Error != "" {
		return "", fmt.Errorf("%s: %s", tok.Error, tok.ErrorDesc)
	}
	if tok.AccessToken == "" {
		return "", fmt.Errorf("no access token in response")
	}
	return tok.AccessToken, nil
}

func callbackHTML(msg string) string {
	return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;` +
		`background:#0d0e0f;color:#d0d2d5;display:flex;align-items:center;` +
		`justify-content:center;height:100vh;margin:0;font-size:18px">` +
		`<p>` + msg + `</p></body></html>`
}
