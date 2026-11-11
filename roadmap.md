- [x] Build shared RUWATA site shell and eight requested pages.
- [x] Add securely stored, validated quote request form and success confirmation.
- [x] Verify route navigation, form submission, mobile menu and responsive widths.
- [x] Update the About Us page with a full-bleed photo backdrop and the supplied company, mission, FAQ, and quote content.
- [x] Redesign Contact Us page with supplied copy, icon buttons (Get a Quote, WhatsApp, Contact RUWATA) and budget field.
- [x] Design an admin login page.
- [x] Remove the "Forgot password?" link from the admin login page.
- [x] Turn the Our Products section into a shop-style product listing.
- [x] Switch the site to the user's own database for quotes, newsletter, products, orders and admin sign-in.
- [x] Product detail page; "Order now" opens it.
- [x] Real sign-in for the admin login page (admins only).

## Admin + shop + Paystack brief (Nov 2026)
- [x] Database upgrade: SKU, regular/sale price, quote-only, stock, featured, draft/published/archived, image alt text, gallery, solar specs, installation fee; orders with payment + fulfilment status, payments table, settings. Safe to rerun.
- [x] Existing 8 products carried over into the new product shape (prices, images, URLs kept).
- [x] Admin area with sidebar: Dashboard (cards, revenue bar chart, status doughnut, date filters), Products, Categories, Orders, Settings.
- [x] Product list: thumbnail, name, SKU, category, price, stock, visibility, updated; search, filters, sort, pagination; Edit/Preview/Publish/Archive; delete only without orders.
- [x] Product editor with sections, image upload/reorder/alt text, price validation, quote-only, stock, specs, Save Draft/Preview/Publish.
- [x] Storefront: prices, availability, Add to Cart, Buy Now, Request a Quote, unavailable status.
- [x] Checkout steps: cart, details, delivery/installation, review, Paystack, confirmation; retry for failed/cancelled.
- [x] Paystack: server-side keys, kobo amounts, unique references, verification, signed webhook, no double stock deduction; disabled message without keys.
- [x] Tests for pricing, sale price rule, purchasability and webhook signature.
- [ ] Paystack test payment end to end — blocked until the user adds Paystack test keys.
- [x] Connect this copy of the site to the user's own database (needs DATABASE_URL, DATABASE_SSL).
- [x] Finish shop look: header cart button, checkout steps, status labels, "added to cart" pop-ups.
- [ ] Delivery fee and pickup address — waiting on the user (currently ₦0, editable in admin Settings).
- [x] Use the uploaded RUWATA icon as the site favicon.
- [x] Add page titles, descriptions and keywords across the site.
- [x] Restyle the product detail page: big main photo, small thumbnail boxes that swap the big photo on click.
- [x] Remove temporary test admin, test orders and test photo used for checking.

## News posts (Nov 2026)
- [x] Posts table in the database.
- [x] Admin News menu, posts list (search, filters, publish, archive, delete) and writing page with SEO checklist.
- [x] Public News page shows real posts with category filters; article page with share buttons and related posts.
- [x] Editor and article styling; checks for keyword scoring; tested on desktop and phone.

## Shop buttons (Nov 2026)
- [x] Every product shows Add to Cart and Buy Now; Request a Quote removed from products and admin editor.
- [x] Prices for Air Conditioner, Chest Freezer, 55-inch TV, Petrol Generator (user asked for sample prices).
- [x] Give the 4 unpriced products sample prices (AC ₦485k, freezer ₦420k, TV ₦520k, generator ₦390k).
- [x] Restyle shop filter as dropdowns and add a price filter.
- [x] Shorter top banner on Our Impact, About Us, Our Products, News, Contact Us.

## Nov 6 2026
- [x] Rebrand the news article (post details) page.
- [x] Shorten the homepage shop heading "Solar systems, appliances and backup power."
