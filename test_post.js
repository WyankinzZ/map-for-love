const { POST } = require("./.next/standalone/.next/server/app/api/memories/route.js");

const dummyRequest = {
  json: async () => ({
    memory: {
      cityId: "shaanxi_xian",
      date: "2026.06.03",
      text: "123",
      image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      photos: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="]
    }
  }),
  cookies: {
    get: () => ({ value: "admin" }) // Fake token? Wait, auth is required!
  }
};

// We need to bypass auth or mock it.
// Actually, I can just mock the whole cookies object. But token verification is complex.
// Maybe I can just call the internal functions!
