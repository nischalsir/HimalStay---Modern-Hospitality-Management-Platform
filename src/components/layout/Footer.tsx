import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-card/40 mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo2.png" alt="HimalStay Logo" className="h-16 w-auto object-contain" />
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              Experience genuine hospitality, modern comfort, and a peaceful retreat in the heart of the Himalayas. Your unforgettable stay starts here.
            </p>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Explore</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/hotels" className="hover:text-gold">Our Rooms</Link></li>
              <li><Link to="/about" className="hover:text-gold">About Us</Link></li>
              <li><Link to="/contact" className="hover:text-gold">Contact</Link></li>
              {/* Added Partner link here */}
              <li><Link to="/partner/apply" className="hover:text-gold font-medium text-gold/90">Apply for Partner</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Guest Portal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/auth/login" className="hover:text-gold">Sign in</Link></li>
              <li><Link to="/auth/register" className="hover:text-gold">Create account</Link></li>
              <li><Link to="/dashboard/bookings" className="hover:text-gold">My reservations</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Contact</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>hello@himalstay.com</li>
              <li>+977 9800000000</li>
              <li>Kathmandu, Nepal</li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/40 pt-6 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} HimalStay. All rights reserved.</p>
          <p>@2026</p>
        </div>
      </div>
    </footer>
  );
}