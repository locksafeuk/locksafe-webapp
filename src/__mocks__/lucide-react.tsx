import React from "react";

// Create a generic icon mock that returns an SVG element
const createMockIcon = (name: string) => {
  const Icon = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
    (props, ref) => <svg ref={ref} data-testid={`icon-${name}`} {...props} />
  );
  Icon.displayName = name;
  return Icon;
};

// Export all commonly used icons as mocks
export const Facebook = createMockIcon("Facebook");
export const Instagram = createMockIcon("Instagram");
export const Linkedin = createMockIcon("Linkedin");
export const Twitter = createMockIcon("Twitter");
export const Mail = createMockIcon("Mail");
export const Phone = createMockIcon("Phone");
export const MapPin = createMockIcon("MapPin");
export const Menu = createMockIcon("Menu");
export const ArrowRight = createMockIcon("ArrowRight");
export const LogIn = createMockIcon("LogIn");
export const LogOut = createMockIcon("LogOut");
export const User = createMockIcon("User");
export const ChevronDown = createMockIcon("ChevronDown");
export const AlertCircle = createMockIcon("AlertCircle");
export const Shield = createMockIcon("Shield");
export const CheckCircle2 = createMockIcon("CheckCircle2");
export const Clock = createMockIcon("Clock");
export const FileCheck = createMockIcon("FileCheck");
export const Eye = createMockIcon("Eye");
export const AlertTriangle = createMockIcon("AlertTriangle");
export const Scale = createMockIcon("Scale");
export const Users = createMockIcon("Users");
export const Quote = createMockIcon("Quote");
export const Search = createMockIcon("Search");
export const FileText = createMockIcon("FileText");
export const Wrench = createMockIcon("Wrench");
export const PenTool = createMockIcon("PenTool");
export const Hand = createMockIcon("Hand");
export const UserCheck = createMockIcon("UserCheck");
export const Info = createMockIcon("Info");
export const PoundSterling = createMockIcon("PoundSterling");
export const Lock = createMockIcon("Lock");
export const Home = createMockIcon("Home");
export const Building2 = createMockIcon("Building2");
export const Car = createMockIcon("Car");
export const Key = createMockIcon("Key");
export const DoorOpen = createMockIcon("DoorOpen");
export const ShieldCheck = createMockIcon("ShieldCheck");
export const Zap = createMockIcon("Zap");
export const MessageSquare = createMockIcon("MessageSquare");
export const Send = createMockIcon("Send");
export const HelpCircle = createMockIcon("HelpCircle");
export const ArrowDown = createMockIcon("ArrowDown");
export const Star = createMockIcon("Star");
export const TrendingUp = createMockIcon("TrendingUp");
export const Award = createMockIcon("Award");
export const Target = createMockIcon("Target");
export const Lightbulb = createMockIcon("Lightbulb");
export const Heart = createMockIcon("Heart");
export const BadgeCheck = createMockIcon("BadgeCheck");

// Catch-all for any other icons
const handler: ProxyHandler<Record<string, unknown>> = {
  get: (_target, prop: string) => {
    if (typeof prop === "string" && prop[0] === prop[0]?.toUpperCase()) {
      return createMockIcon(prop);
    }
    return undefined;
  },
};

export default new Proxy({}, handler);
