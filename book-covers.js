/* AxomPrep verified/located cover images.
   These are image URLs from publisher/book-retailer/Google Books pages.
   Database cover_url values take precedence; this map fills missing covers. */
window.AXOMPREP_BOOK_COVERS = {
  "Assam Year Book 2026": "https://www.assambookbazaar.com/storage/assam-year-book-2026-1-400x400.jpeg",
  "Assam History & Culture for APSC & ADRE": "https://d34a0mln2492j4.cloudfront.net/unsigned/resize%3Afit%3A498%3A593%3A0/gravity%3Asm/plain/https%3A%2F%2Fimage-hub.reproindialtd.com%2F9789364443432.jpg",
  "History of Assam for ADRE & Assam State Competitive Exams": "https://dishapublication.com/cdn/shop/files/9789371867771.jpg?v=1757568707&width=530",
  "The Assam Mathematics Concept": "https://st.adda247.com/https%3A//storeimages.adda247.com/544701709732399.png",
  "Disha GoTo Guide for ADRE Grade III & IV": "https://dishapublication.com/cdn/shop/files/9789371868976.jpg?v=1759143583&width=530",
  "Disha 10 Year-wise Solved Papers & 10 Practice Sets for ADRE": "https://dishapublication.com/cdn/shop/files/9789371863858.jpg?v=1759145823&width=530",
  "5000+ MCQs on Assam & Northeast": "https://www.schandpublishing.com/Handler/ImageHandler.ashx?height=404&imgpath=~%2FUpload%2FBookImage%2F9789373596709.jpg&width=314",
  "Know Your State Assam": "https://books.google.com/books/content?id=hhrzDwAAQBAJ&printsec=frontcover&img=1&zoom=2&source=gbs_api",
  "Lucent's General Knowledge": "https://books.google.com/books/content?id=sf0AngEACAAJ&printsec=frontcover&img=1&zoom=2&source=gbs_api",
  "Indian Polity": "https://books.google.com/books/content?id=k_Bb0AEACAAJ&printsec=frontcover&img=1&zoom=2&source=gbs_api",
  "Quantitative Aptitude for Competitive Examinations": "https://books.google.com/books/content?id=S1i-0AEACAAJ&printsec=frontcover&img=1&zoom=2&source=gbs_api",
  "A Modern Approach to Verbal & Non-Verbal Reasoning": "https://books.google.com/books/content?id=JqoA0gEACAAJ&printsec=frontcover&img=1&zoom=2&source=gbs_api",
  "Objective General English": "https://books.google.com/books/content?id=pLFJEAAAQBAJ&printsec=frontcover&img=1&zoom=2&source=gbs_api",
  "Fast Track Objective Arithmetic": "https://books.google.com/books/content?id=GBrzDwAAQBAJ&printsec=frontcover&img=1&zoom=2&source=gbs_api",
  "Indian Economy": "https://books.google.com/books/content?id=DZUN0AEACAAJ&printsec=frontcover&img=1&zoom=2&source=gbs_api",
  "Certificate Physical Geography": "https://books.google.com/books/content?id=P8cqAAAACAAJ&printsec=frontcover&img=1&zoom=2&source=gbs_api",
  "General English for Competitive Exams": "https://books.google.com/books/content?id=SLwxzgEACAAJ&printsec=frontcover&img=1&zoom=2&source=gbs_api"
};

window.getAxomPrepBookCover = function(book){
  if(!book) return '';
  const direct=String(book.cover_url||'').trim();
  if(direct) return direct;
  return String(window.AXOMPREP_BOOK_COVERS?.[String(book.title||'')]||'').trim();
};
