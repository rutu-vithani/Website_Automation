html
<!-- full index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Adorn Jewels</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <nav class="navbar" id="navbar">
    <div class="nav-inner container">
      <a href="#home" class="nav-logo">Adorn Jewels</a>
      <ul class="nav-links" id="navLinks">
        <li><a href="#collections" class="nav-link">Collections</a></li>
        <li><a href="#about" class="nav-link">About</a></li>
        <li><a href="#services" class="nav-link">Services</a></li>
        <li><a href="#gallery" class="nav-link">Gallery</a></li>
        <li><a href="#testimonials" class="nav-link">Testimonials</a></li>
        <li><a href="#contact" class="nav-link">Contact</a></li>
      </ul>
      <a href="#contact" class="btn btn-primary nav-cta">Get in Touch</a>
      <button class="nav-hamburger" id="navHamburger" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </nav>
  <section class="hero" id="home">
    <div class="hero-bg">
      <img src="https://images.unsplash.com/photo-1622704776938-bed6cd156e04?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5ODY3Mjl8MHwxfHNlYXJjaHwxfHxqZXdlbHJ5JTIwc3RvcmUlMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzgyODc4ODM0fDA&ixlib=rb-4.1.0&q=80&w=1080" alt="Adorn Jewels interior">
      <div class="hero-overlay"></div>
    </div>
    <div class="hero-content container">
      <p class="hero-eyebrow">Established 2020 · New York</p>
      <h1 class="hero-heading">
        Where Every<br><em>Adorn</em> is a Treasure
      </h1>
      <p class="hero-sub">Experience the art of fine jewelry craftsmanship in a luxurious atmosphere.</p>
      <div class="hero-actions">
        <a href="#collections" class="btn btn-primary">Explore Our Collections ↗</a>
        <a href="#contact" class="btn btn-outline" style="border-color:rgba(255,255,255,0.4);color:#fff;">
          Get in Touch
        </a>
      </div>
    </div>
    <div class="hero-scroll-hint">
      <span>Scroll</span>
      <div class="scroll-line"><div class="scroll-dot"></div></div>
    </div>
  </section>
  <section class="collections" id="collections">
    <div class="container">
      <div class="sec-header reveal">
        <div class="sec-eyebrow"><div class="line"></div><span>Collections</span></div>
        <h2 class="sec-heading">Discover Our Masterpieces</h2>
      </div>
      <div class="collections-grid">
        <div class="collection reveal">
          <div class="collection-image img-frame ratio-1-1">
            <img src="https://images.unsplash.com/photo-1604306354577-68136efdf03b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5ODY3Mjl8MHwxfHNlYXJjaHw0fHxqZXdlbHJ5JTIwc3RvcmUlMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzgyODc4ODM0fDA&ixlib=rb-4.1.0&q=80&w=1080" alt="Diamond engagement ring">
          </div>
          <div class="collection-info">
            <h3 class="collection-title">Diamond Engagement Rings</h3>
            <p class="collection-desc">Handcrafted with precision and love, our diamond engagement rings are truly one-of-a-kind.</p>
            <button class="btn btn-primary">Learn More</button>
          </div>
        </div>
        <!-- repeat -->
      </div>
    </div>
  </section>
  <section class="about" id="about">
    <div class="container">
      <div class="sec-header reveal">
        <div class="sec-eyebrow"><div class="line"></div><span>About Us</span></div>
        <h2 class="sec-heading">Our Story</h2>
      </div>
      <div class="about-content reveal">
        <p>Adorn Jewels is a family-owned business with a passion for creating exquisite jewelry pieces. Our team of expert craftsmen work tirelessly to bring your vision to life.</p>
        <p>From engagement rings to custom designs, we offer a wide range of services to cater to your unique needs.</p>
      </div>
    </div>
  </section>
  <section class="services" id="services">
    <div class="container">
      <div class="sec-header reveal">
        <div class="sec-eyebrow"><div class="line"></div><span>Services</span></div>
        <h2 class="sec-heading">What We Offer</h2>
      </div>
      <div class="services-grid">
        <div class="service reveal">
          <div class="service-icon">👜</div>
          <div class="service-info">
            <h3 class="service-title">Custom Jewelry Design</h3>
            <p class="service-desc">Bring your unique vision to life with our expert custom jewelry design services.</p>
          </div>
        </div>
        <div class="service reveal">
          <div class="service-icon">📦</div>
          <div class="service-info">
            <h3 class="service-title">Gift Wrapping and Engraving</h3>
            <p class="service-desc">Make your gift even more special with our gift wrapping and engraving services.</p>
          </div>
        </div>
      </div>
    </div>
  </section>
  <section class="gallery" id="gallery">
    <div class="container">
      <div class="sec-header reveal">
        <div class="sec-eyebrow"><div class="line"></div><span>Gallery</span></div>
        <h2 class="sec-heading">Our Masterpieces</h2>
      </div>
      <div class="gallery-grid">
        <div class="gallery-item reveal">
          <div class="gallery-image img-frame ratio-1-1">
            <img src="https://images.unsplash.com/photo-1580582202907-d01fd0bd4c87?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5ODY3Mjl8MHwxfHNlYXJjaHwyfHxqZXdlbHJ5JTIwc3RvcmUlMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzgyODc4ODM0fDA&ixlib=rb-4.1.0&q=80&w=1080" alt="Gold and silver jewelry">
          </div>
          <div class="gallery-info">
            <h3 class="gallery-title">Gold and Silver Jewelry</h3>
            <p class="gallery-desc">Handcrafted with precision and love, our gold and silver jewelry pieces are truly one-of-a-kind.</p>
          </div>
        </div>
        <!-- repeat -->
      </div>
    </div>
  </section>
  <section class="testimonials" id="testimonials">
    <div class="container">
      <div class="sec-header reveal">
        <div class="sec-eyebrow"><div class="line"></div><span>Testimonials</span></div>
        <h2 class="sec-heading">What Our Clients Say</h2>
      </div>
      <div class="testimonials-grid">
        <div class="testimonial reveal">
          <div class="testimonial-quote">"</div>
          <p class="testimonial-text">Adorn Jewels is a hidden gem! The quality of their jewelry is exceptional and the service is top-notch.</p>
          <div class="testimonial-author">
            <div class="testimonial-avatar img-frame ratio-1-1">
              <img src="https://images.unsplash.com/photo-1605100804763-247f67b3557e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5ODY3Mjl8MHwxfHNlYXJjaHwxfHxkaWFtb25kJTIwZW5nYWdlbWVudCUyMHJpbmdzfGVufDB8MHx8fDE3ODI4Nzg4MzZ8MA&ixlib=rb-4.1.0&q=80&w=1080" alt="Jewelry designer at work">
            </div>
            <div>
              <div class="testimonial-name">Emily R.</div>
              <div class="testimonial-role">Happy Client</div>
            </div>
          </div>
        </div>
        <!-- repeat -->
      </div>
    </div>
  </section>
  <section class="contact" id="contact">
    <div class="container">
      <div class="contact-grid">
        <div class="contact-info reveal">
          <div class="sec-eyebrow"><div class="line"></div><span>Get in Touch</span></div>
          <h2 class="sec-heading">Contact Us</h2>
          <div class="contact-details">
            <div class="contact-detail">
              <div class="contact-icon">📍</div>
              <div>
                <strong>Address</strong>
                <p>123 Main St, New York, NY 10001</p>
              </div>
            </div>
            <div class="contact-detail">
              <div class="contact-icon">📞</div>
              <div>
                <strong>Phone</strong>
                <p>555-555-5555</p>
              </div>
            </div>
            <div class="contact-detail">
              <div class="contact-icon">📧</div>
              <div>
                <strong>Email</strong>
                <p>info@adornjewels.com</p>
              </div>
            </div>
          </div>
        </div>
        <div class="contact-form-wrap reveal">
          <form class="contact-form" onsubmit="return false;">
            <div class="form-row">
              <div class="form-field">
                <label>Name</label>
                <input type="text" placeholder="John Doe">
              </div>
              <div class="form-field">
                <label>Email</label>
                <input type="email" placeholder="johndoe@example.com">
              </div>
            </div>
            <div class="form-field">
              <label>Message</label>
              <textarea placeholder="Type your message here..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Send Message</button>
          </form>
        </div>
      </div>
    </div>
  </section>
  <footer class="footer dark-section">
    <div class="container">
      <div class="footer-top">
        <div class="footer-brand">
          <a href="#" class="footer-logo">Adorn Jewels</a>
          <p>Experience the art of fine jewelry craftsmanship in a luxurious atmosphere.</p>
          <div class="footer-social">
            <a href="#" aria-label="Instagram">IG</a>
            <a href="#" aria-label="Facebook">FB</a>
            <a href="#" aria-label="Twitter">TW</a>
          </div>
        </div>
        <div class="footer-col">
          <h4>Visit Us</h4>
          <p>123 Main St, New York, NY 10001</p>
        </div>
        <div class="footer-col">
          <h4>Hours</h4>
          <p>Mon–Fri: 9am–5pm<br>Sat–Sun: 10am–6pm</p>
        </div>
        <div class="footer-col">
          <h4>Follow Us</h4>
          <a href="#" aria-label="Instagram">Instagram</a>
          <a href="#" aria-label="Facebook">Facebook</a>
          <a href="#" aria-label="Twitter">Twitter</a>
        </div>
      </div>
      <div class="footer-bar">
        <span>2023 Adorn Jewels. All rights reserved.</span>
        <span>Made with love in New York</span>
      </div>
    </div>
  </footer>
  <script src="script.js"></script>
</body>
</html>