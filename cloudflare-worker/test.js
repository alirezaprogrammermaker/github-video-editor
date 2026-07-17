// Test script to trigger the workflow via the Cloudflare Worker
// Run: node test.js

const WORKER_URL = "http://localhost:8787"; // Local dev URL

const payload = {
  video_url:
    "https://ig-proxy.dknow2296.workers.dev/?url=https://scontent-otp1-1.cdninstagram.com/o1/v/t2/f2/m86/AQMZYcktCqIwk2NGCTzRQevzclIjYVEJAVwYpnLj7tmJ3MxD54tk_vHS_xmRi46D4S5tV6QJxT4wEhrJbsJaPxQg3vjRk9sd6jv8dp0.mp4?_nc_cat=100&_nc_sid=5e9851&_nc_ht=scontent-otp1-1.cdninstagram.com&_nc_ohc=15HR2BGbS6AQ7kNvwHdDMsU&efg=eyJ2ZW5jb2RlX3RhZyI6Inhwdl9wcm9ncmVzc2l2ZS5JTlNUQUdSQU0uQ0xJUFMuQzMuNzIwLmRhc2hfYmFzZWxpbmVfMV92MSIsInhwdl9hc3NldF9pZCI6MTM0MjU2MzkwODA3NjI5MiwiYXNzZXRfYWdlX2RheXMiOjgxLCJ2aV91c2VjYXNlX2lkIjoxMDA5OSwiZHVyYXRpb25fcyI6MTMsInVybGdlbl9zb3VyY2UiOiJ3d3cifQ%3D%3D&ccb=17-1&vs=6c9f067529f7c5b3&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8xMDQzRTdGQTNBQTlGNDg0MTRERDFFNkEzODcyQTVCRF92aWRlb19kYXNoaW5pdC5tcDQVAALIARIAFQIYUWlnX3hwdl9wbGFjZW1lbnRfcGVybWFuZW50X3YyLzBCNDhEQzNDQkE2M0UyMjU5QTkxODI2NjJGN0U1NTk4X2F1ZGlvX2Rhc2hpbml0Lm1wNBUCAsgBEgAoABgAGwKIB3VzZV9vaWwBMRJwcm9ncmVzc2l2ZV9yZWNpcGUBMRUAACaIjKLNwMPiBBUCKAJDMywXQCuIMSbpeNUYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HZeadAQA&_nc_gid=_zPglZFKXGiLLIQBWOM26g&_nc_zt=28&_nc_ss=7a22e&oh=00_AQDMiIul3MWrDP4g1775xAjmyLA3QR1Gd6pF85-jHcVOew&oe=6A5BBD75",
  static_text: "یک پدر و دوازده فرزند",
  marquee_text: "برای خرید فالوور اینستاگرام به آیا ig_shop پیام بدید",
  watermark_text: "@insta_shop",
  output_format: "mp4",
};

async function test() {
  console.log("Testing worker at:", WORKER_URL);
  console.log("Payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log("\nResponse status:", response.status);
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error.message);
  }
}

test();
