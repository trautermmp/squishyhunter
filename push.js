const webpush  = require('web-push');
const supabase = require('./supabase');

const vapidReady = process.env.VAPID_EMAIL && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY;
if (vapidReady) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R    = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function sendPushForReport(report) {
  if (!supabase) return;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  const { data: subs } = await supabase.from('push_subscriptions').select('*');
  if (!subs?.length) return;

  const payload = JSON.stringify({
    title: `🧸 ${report.status === 'in_stock' ? 'In Stock' : 'Sighting'} at ${report.store_name}`,
    body:  `${(report.product_id || '').replace(/-/g, ' ')} spotted${report.qty ? ` — ${report.qty} seen` : ''}`,
  });

  const sends = subs
    .filter(sub => {
      if (!sub.lat || !sub.lng || !report.lat || !report.lng) return true;
      return haversineMiles(sub.lat, sub.lng, report.lat, report.lng) <= 25;
    })
    .map(async sub => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err) {
        // 410 Gone = subscription expired, remove it
        if (err.statusCode === 410 && supabase) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
      }
    });

  await Promise.allSettled(sends);
}

module.exports = { sendPushForReport };
