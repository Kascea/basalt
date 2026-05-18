package supabase

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	authURL      = "https://api.supabase.com/v1/oauth/authorize"
	tokenURL     = "https://api.supabase.com/v1/oauth/token"
	callbackPort = 7740
)

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	Error        string `json:"error"`
	ErrorDesc    string `json:"error_description"`
}

func generatePKCE() (verifier, challenge string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return
	}
	verifier = base64.RawURLEncoding.EncodeToString(b)
	sum := sha256.Sum256([]byte(verifier))
	challenge = base64.RawURLEncoding.EncodeToString(sum[:])
	return
}

func authenticate(clientID, clientSecret string, openBrowser func(string)) (tokenResponse, error) {
	ln, err := net.Listen("tcp", fmt.Sprintf("localhost:%d", callbackPort))
	if err != nil {
		return tokenResponse{}, fmt.Errorf("port %d is already in use — is another sign-in in progress?", callbackPort)
	}
	redirectURI := fmt.Sprintf("http://localhost:%d/callback", callbackPort)

	verifier, challenge, err := generatePKCE()
	if err != nil {
		return tokenResponse{}, fmt.Errorf("generating PKCE: %w", err)
	}

	codeCh := make(chan string, 1)
	errCh := make(chan error, 1)

	mux := http.NewServeMux()
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		if errParam := r.URL.Query().Get("error"); errParam != "" {
			desc := r.URL.Query().Get("error_description")
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			fmt.Fprint(w, callbackHTML(false, "Authorization failed: "+errParam))
			errCh <- fmt.Errorf("%s: %s", errParam, desc)
			return
		}
		code := r.URL.Query().Get("code")
		if code == "" {
			errCh <- fmt.Errorf("no authorization code in callback")
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, callbackHTML(true, "Connected to Supabase"))
		codeCh <- code
	})

	srv := &http.Server{Handler: mux}
	go srv.Serve(ln) //nolint:errcheck
	defer srv.Close()

	params := url.Values{
		"client_id":             {clientID},
		"redirect_uri":          {redirectURI},
		"response_type":         {"code"},
		"code_challenge":        {challenge},
		"code_challenge_method": {"S256"},
	}
	openBrowser(authURL + "?" + params.Encode())

	select {
	case code := <-codeCh:
		return exchangeCode(clientID, clientSecret, code, verifier, redirectURI)
	case err := <-errCh:
		return tokenResponse{}, err
	case <-time.After(5 * time.Minute):
		return tokenResponse{}, fmt.Errorf("authentication timed out")
	}
}

func exchangeCode(clientID, clientSecret, code, verifier, redirectURI string) (tokenResponse, error) {
	body := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {redirectURI},
		"code_verifier": {verifier},
	}
	return doTokenRequest(clientID, clientSecret, body)
}

func refreshAccessToken(clientID, clientSecret, refreshTok string) (tokenResponse, error) {
	body := url.Values{
		"grant_type":    {"refresh_token"},
		"refresh_token": {refreshTok},
	}
	return doTokenRequest(clientID, clientSecret, body)
}

func doTokenRequest(clientID, clientSecret string, body url.Values) (tokenResponse, error) {
	req, err := http.NewRequest("POST", tokenURL, strings.NewReader(body.Encode()))
	if err != nil {
		return tokenResponse{}, fmt.Errorf("token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	req.SetBasicAuth(clientID, clientSecret)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return tokenResponse{}, fmt.Errorf("token exchange: %w", err)
	}
	defer resp.Body.Close()

	var tok tokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tok); err != nil {
		return tokenResponse{}, fmt.Errorf("decoding token response: %w", err)
	}
	if tok.Error != "" {
		return tokenResponse{}, fmt.Errorf("%s: %s", tok.Error, tok.ErrorDesc)
	}
	if tok.AccessToken == "" {
		return tokenResponse{}, fmt.Errorf("no access token in response")
	}
	return tok, nil
}

func callbackHTML(success bool, msg string) string {
	icon := `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`
	color := "#4ade80"
	autoclose := `<script>setTimeout(()=>window.close(),2000)</script>`
	if !success {
		icon = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`
		color = "#f87171"
		autoclose = ""
	}
	return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Basalt</title></head><body style="font-family:system-ui,sans-serif;background:#0d0e0f;color:#d0d2d5;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;gap:16px;text-align:center">` +
		icon +
		`<p style="font-size:16px;font-weight:600;color:` + color + `;margin:0">` + msg + `</p>` +
		`<p style="font-size:13px;color:#666;margin:0">You can close this tab</p>` +
		autoclose +
		`</body></html>`
}
