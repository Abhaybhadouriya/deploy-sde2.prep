import { Link } from "react-router-dom";
import { REVISION_NAV_LINKS } from "../../utils/revisionHelpers";

export default function RevisionSiteHeader({ activeKey, navLabel }) {
  return (
    <header className="site">
      <div className="site-nav">
        <Link to="/" className="brand">
          <span className="dot"></span> sde2.prep
        </Link>
        <nav className="site-links">
          {REVISION_NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={link.key === activeKey ? "active" : ""}
            >
              {link.key === activeKey ? navLabel : link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
