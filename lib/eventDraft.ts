// Module-level draft store — persists step 2 & 3 state across back-navigation remounts

export const draft2: {
  title: string; tagline: string; tags: string[];
  cover: string | null; postAs: string; // club ID or 'individual'
} = { title: '', tagline: '', tags: [], cover: null, postAs: 'individual' };

export const draft3: {
  date: Date | null; time: Date | null; duration: string;
  venue: string; venueLat?: number; venueLng?: number;
  price: string; payAtDoor: boolean;
  isRecurring: boolean; recurringEndDate: Date | null;
  extraCovers: string[];
} = {
  date: null, time: null, duration: '2',
  venue: '', price: '0', payAtDoor: false,
  isRecurring: false, recurringEndDate: null,
  extraCovers: [],
};

export function clearDrafts() {
  draft2.title = ''; draft2.tagline = ''; draft2.tags = [];
  draft2.cover = null; draft2.postAs = 'individual';
  draft3.date = null; draft3.time = null; draft3.duration = '2';
  draft3.venue = ''; draft3.venueLat = undefined; draft3.venueLng = undefined;
  draft3.price = '0'; draft3.payAtDoor = false;
  draft3.isRecurring = false; draft3.recurringEndDate = null;
  draft3.extraCovers = [];
}
