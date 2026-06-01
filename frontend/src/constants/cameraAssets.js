// Design-provided placeholder media (used for offline / cloud-standby tiles)
export const PLACEHOLDERS = [
  "https://static.prod-images.emergentagent.com/jobs/288391c6-8aef-4ecc-8f81-3ef97e9ae800/images/a02422928168d5d33c932b63b550d32f8b3983b8832b71caad0407c58015f589.png",
  "https://static.prod-images.emergentagent.com/jobs/288391c6-8aef-4ecc-8f81-3ef97e9ae800/images/14b84e9b48ff1845f16bb985d1d6d011d5aaf73f54fb26144bf835702288fd48.png",
  "https://static.prod-images.emergentagent.com/jobs/288391c6-8aef-4ecc-8f81-3ef97e9ae800/images/0954bbbb12e674e20fd36851f547de32f84f217fe5cffeba25ac0f370a487473.png",
];

export const TEXTURE =
  "https://static.prod-images.emergentagent.com/jobs/288391c6-8aef-4ecc-8f81-3ef97e9ae800/images/2562184460c999aff94699d445f63fd25ecaf0688c03c8ed9ffe3dbac69ed37e.png";

export const placeholderFor = (i) => PLACEHOLDERS[Math.abs(i) % PLACEHOLDERS.length];
