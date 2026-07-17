// n8n credentials for the SocialPost API
class SocialPostApi {
  constructor() {
    this.name = "socialPostApi";
    this.displayName = "SocialPost API";
    this.documentationUrl = "http://localhost:3000/docs";
    this.properties = [
      {
        displayName: "API Key",
        name: "apiKey",
        type: "string",
        typeOptions: { password: true },
        default: "",
      },
      {
        displayName: "Base URL",
        name: "baseUrl",
        type: "string",
        default: "http://localhost:3000",
      },
    ];
    this.authenticate = {
      type: "generic",
      properties: {
        headers: { Authorization: "=Apikey {{$credentials.apiKey}}" },
      },
    };
  }
}
module.exports = { SocialPostApi };
