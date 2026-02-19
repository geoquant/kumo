Preface

This is the ebook version of
for you because we thought you might like to read about CSS layout in this format, and offline.

 and contains all of the same content. We made it

every-layout.dev
↗

An EPUB book cannot do or show all the things a website can, and the interactive demos are
replaced with links back to the
demos, you have to purchase the full version of
you have hopefully done that already. After purchase, a link to the full, unlocked site will
accompany the link to this book in an email.

 website. To see all of these pages and

. If you are looking at this book,

every-layout.dev
↗

Every
Layout

All external links in this book are marked with a ↗ symbol/character. If you see a link not suffixed
with ↗, it points to a section within the book itself. The book has been tested to render and
behave as expected in the latest versions of Apple’s iBooks, and the

Calibre e-book manager
↗
.

Editions

Version	3.1.7.14	(current)

This edition introduced the
queries.

Container

Third	edition

 pseudo-layout: a launchpad for working with container

logical
properties
This edition introduced
their writing modes. It also updated the
which is now widely supported.

 for better compatibility with different languages and
Frame

 component to use the

 property,

aspect-ratio

Second	edition

This edition converted a number of layouts to use the
supported with Flexbox as well as Grid. Using
easier to understand.

gap

gap

 property which has come to be widely

 simplifies many layouts and makes them

First	edition

We actually added a lot more content after the initial release but we hadn’t started recording
“editions” so all of those updates are implicitly part of the first edition.

Ownership

When you purchase a licence for
authored and owned by Heydon Pickering and Andy Bell.

Every
Layout

, you own a license to the content that is

Fair	usage	and	redistribution

Re-publishing and re-selling of
be pursued, legally, in accordance with United Kingdom copyright law.

Every
Layout

 is strictly forbidden and discovered instances will

We expect licence holders to use their licence in a fair manner. We put a lot of trust in our
 as frictionless as possible. We believe
licence holders so that we can make using
that you, the licence holder, should be able to access the content that you paid for with little to
no barriers, but this also means that the licence is easily shared.

Every
Layout

If we suspect you are not using your license in a fair manner or sharing it irresponsibly, we
reserve the right to revoke your access to

 with no refunds, after a fair warning.

Every
Layout

Rudiments

Boxes
Composition
Units
Global and local styling
Modular scale
Axioms

Layouts

The Stack
The Box
The Center
The Cluster
The Sidebar
The Switcher
The Cover
The Grid
The Frame
The Reel
The Imposter
The Icon
The Container

Boxes

 has reminded us,

Rachel Andrew
↗

As
box. Not everything necessarily
 like a box—
deceptive, but everything takes up a box-like space. Layout is inevitably, therefore, the
arrangement of boxes.

everything in web design is a box
↗

border-radius clip-path

, and

looks

, or the absence of a
 can be

transforms

,

Before one can embark on combining boxes to make
familiar with how boxes themselves are designed to behave as standard.

composite layouts

, it is important to be

The	box	model

box model
↗

 is the formula upon which layout boxes are based, and comprises content,

The
padding, border, and margin. CSS lets us alter these values to change the overall size and shape
of elements’ display.

Web browsers helpfully apply default CSS styles to some elements, meaning they are laid out in
a reasonably readable fashion: even where author CSS has not been applied.

In Chrome, the default user agent styles for paragraphs (

<p>

) look like…

p	{
		display:	block;
		margin-block-start:	1em;
		margin-block-end:	1em;
		margin-inline-start:	0px;
		margin-inline-end:	0px;
}

… and unordered list (

<ul>

) styles look like…

ul	{
		display:	block;
		list-style-type:	disc;
		margin-block-start:	1em;
		margin-block-end:	1em;
		margin-inline-start:	0px;
		margin-inline-end:	0px;
		padding-inline-start:	40px;
}

The

display

	property

In both the above examples, the element's
display
assume all of the available space in one dimension. Typically, this is the horizontal dimension,
because the
In some cases, and for some languages (
mode.

 (horizontal; with a top to bottom flow direction).

like Mongolian
↗ vertical-lr

 property is set to

. Block elements

 is the appropriate writing

horizontal-tb

 is set to

writing-mode

block

),

display

Inline elements (with the
current context, writing mode, and direction. They are only as wide as their content, and are
placed adjacently wherever there is space to do so. Block elements follow flow direction, and
inline elements follow writing direction.

) behave differently. They are laid out

 value

in
line

inline

 with the

Thinking typographically, it could be said that block elements are like paragraphs, and inline
elements are like words.

block-level
↗

 elements) afford you control over both the horizontal

Block elements (also called
and vertical dimensions of the box. That is, you can apply width, height, margin, and padding to
a block element and it will take effect. On the other hand, inline elements are sized
(prescribed
values are permitted. Inline elements are designed to conform to the flow of horizontal placement
among other inline elements.

intrinsically
 margin and padding

 values do not take effect) and only

horizontal

 and

height

width

A relatively new display property,
properties on
inline-block
illustration demonstrates.

inline-block

, is a hybrid of

block

 and

inline

. You

can

 set vertical

 elements, although this is not always desirable—as the proceeding

Of the basic

display

 types, only

none

 remains. This value removes the element from the layout

entirely. It has no visual presence, and no impact on the layout of surrounding elements. It is as
if the element itself has been removed from the HTML. Accordingly, browsers do not
communicate the presence or content of
screen reader software
↗
.

 elements to assistive technologies like

display:	none

Logical	properties

logical properties
↗

What are
properties? English speakers accustomed to reading left to right (
bottom (
“right”, “top”, and “bottom” when applying styles like margin and padding.

 and does their existence imply the existence of

writing-mode:	horizontal-tb

direction:	ltr

) find it logical to use properties that include the words “left”,

illogical

) and top to

.icon	{
		margin-right:	0.5em;
}

It’s when the direction or writing mode changes that this becomes illogical, because left and right
(and/or top and bottom) are flipped. Now the margin you put on the right you really need on the
left.

Logical properties eschew terminology like “left” and “right” because we know they can be
reversed, making the terms a nonsense. Instead, we apply styles like margin, padding, and
border according to the block and inline direction.

.icon	{
		margin-inline-end:	0.5em;
}

In a

 direction,

ltr
 applies margin to the left. In both cases, it is applied where it is needed: at the end of the

 applies margin to the right. In a

margin-inline-end

 direction,

margin-inline-

rtl

end
inline dimension.

Formatting	contexts

display:	flex

display:	grid

display:	block

When you apply
element, using
example, with just
its children will distribute themselves horizontally. Or, to put it another way, the
switched from vertical to horizontal.

 or
. However, it changes the way its

 (and no other Flexbox-related properties) applied to the parent,
 is

, it continues to behave like a block

 elements behave. For

flow
direction

display:	flex

 to a

child

<div>

Formatting contexts are the basis of many of the layouts documented in this project. They turn
elements into layout components. In
contexts can be nested, to create

, we'll explore how different formatting

Composition

composite

 layouts.

Content	in	boxes

The web is a conduit for primarily textual information supplemented by media such as images
content
and videos, often referred to collectively as
scrolling algorithms to make sure content is transmitted to the user in its entirety, irrespective of
their screen sizes and dimensions, and settings such as zoom level. The web is
largely by default.

. Browsers incorporate line wrapping and

responsive

↗

Without intervention, it is the contents of an element that determines its size and shape. Content
makes
inline
devices, the
content is
misleading. Working directly with CSS and its flexibility from the outset, as we are here, is highly
recommended.

 elements grow vertically. Left to its own
 of a box is determined by the area of the content it contains. Because web
 (subject to change), static representations of web layouts are extremely

 elements grow horizontally, and
area
dynamic

block

If
you
halve
the
width
of
an
element,
it
will
have
to
be
twice
as
tall
to
contain
the
same
amount
of
content

The

box-sizing

	property

By default, the dimensions of a box are the dimensions of the box’s content
border values (implicitly:
then add padding on both sides of
 of right padding. If you opt for

1rem
accommodate the padding and the total width equals the prescribed

box-sizing:	content-box

box-sizing:	border-box

, it will be

 wide:

 plus

10rem

width

12rem

1rem

1rem
, the content area is reduced to

). That is, if you set an element to be

plus

 its padding and
 wide,
 of left padding and

10rem

 of

.
10rem

Generally, it is considered preferable to use the
calculating/anticipating box dimensions easier.

border-box

 model for all boxes. It makes

Any styles, like
the   (“universal” or “wildcard”) selector. As covered in detail in

box-sizing:	border-box

*

, that are applicable to all elements are best applied using

Global
and
local
styling

, being

able to affect the layout of multiple elements (in this case,
CSS brings efficiency to layout design.

all

 elements) simultaneously is how

*	{
		box-sizing:	border-box;
}

Exceptions

There are exceptions to the
content
measurement of the
exceptions to general rules.

border-box
 is critical. CSS's

 rule-of-thumb, such as in the

Center
 is designed to accommodate

 layout

 where

cascade
↗

*	{
		box-sizing:	border-box;
}

center-l	{
		box-sizing:	content-box;
}

border-box

content-box
 come into play. For illustration, consider a block element placed inside another

Only where the height or width of a box is constrained does the difference between
and
block element. Using the
by
2rem
applied.

 model and a padding of
 in a

 writing mode) is

 (equivalent to

, the child element will overflow

inline-size:	100%

horizontal-tb

content-box

width:	100%

 when

1rem

Why? Because
inline-size:	100%
element”
. Since we are using the
padding is added on to this value.

 means

“make
the
width
of
this
element
the
same
as
the
parent
 is made

 wide, then the

 model, the

content

100%

content-box

inline-size:	auto

But if we use
value) the child box fits within the parent box perfectly. And that’s
value.

 (we can just remove

inline-size:	100%

, since
regardless

auto
 of the

 is the default

box-sizing

Implicitly, the
has no effect.

height

 is also set to

auto

, meaning it is derived from the content. Again,

box-sizing

The lesson here is the dimensions of our elements should be largely
content and outer context. When we try to
should be doing as visual designers is making
shape. We might, for instance, apply a
).
(as in the

suggestions
 (as in the

prescribe

Sidebar

min-height

 dimensions, things tend to go amiss. All we
 as to how the layout should take
Cover

) or proffer a

flex-basis

 layout

derived

 from their inner

The CSS of suggestion is at the heart of algorithmic layout design. Instead of telling browsers
what to do, we allow browsers to make their own calculations, and draw their own conclusions,
to best suit the user, their screen, and device. Nobody should experience obscured content
under any circumstances.

Composition

If you are a programmer, you may have heard of the
The idea is that combining simple independent parts (objects; classes; functions) gives you more
flexibility, and leads to more efficiency, than connecting everything—through inheritance—to a
shared origin.

composition over inheritance
↗

 principle.

Composition
over
inheritance
favor composition in front-end architecture and visual design (
a dedicated page about it
↗
).

 does not have to apply to “business logic”. It is also beneficial to

the React documentation even has

Composition	and	layout

To understand how composition benefits a
Let’s say that this component is a dialog box, because the interface (for reasons we won’t get
into right now)

 a dialog box. Here is what it looks like:

, let’s consider an example component.

layout
system

requires

But how does it get to look like that? One way is to write some dedicated dialog CSS. You might
give the dialog box a “block” identifier (
 in HTML) and use this
as your namespace to attach style declarations.

 in CSS, and

class="dialog"

.dialog

.dialog	{
		/*	...	*/
}

.dialog__header	{
		/*	...	*/
}

.dialog__body	{
		/*	...	*/
}

.dialog__foot	{
		/*	...	*/
}

Alternatively, these dialog styles might be imported from a third-party CSS library/framework. In
either case, a lot of the CSS used to make the dialog
other, similar layouts. But since everything here is namespaced under
make the next component, we’ll end up duplicating would-be shared styles. This is where most
CSS bloat comes from.

 like a dialog, could be used to make

, when we come to

.dialog

look

namespacing

The
finalized parts of UI should be called before we’ve even decided what they
smaller parts can

 part is key here. The inheritance mindset encourages us to think about what
, or what other,

. That’s where composition comes in.

do
for
them

do

Layout	primitives

The mistake in the last example was to think of everything about the dialog’s form as isolated
and unique when, really, it's just a composition of simpler layouts. The purpose of
is to identify and document what each of these smaller layouts are. Together, we call them
primitives

.

Every
Layout

The term primitive has linguistic, mathematical, and computing connotations. In each case, a
in
primitive is something without its own meaning or purpose as such, but which can be used
composition
in mathematics an equation, in design a pattern, or in development a component.

 to make something meaningful, or

. In language it might be a word or phrase,

lexical

) out of
In JavaScript, the Boolean data type is a primitive. Just looking at the value
context tells you very little about the larger JavaScript application. The object data type, on the
other hand, is
Objects are therefore meaningful; they necessarily tell you something of the author’s intent.

 primitive. You cannot write an object without designating your own properties.

 (or

false

not

true

The dialog is meaningful, as a piece of UI, but its constituent parts are not. Here’s how we might
compose the dialog box using

 layout primitives
:

Every
Layout’s

Using many of the same primitives, we can create a registration form…

… or a slide layout for a conference talk:

Intrinsically	responsive

Each layout Every
Layout
 in
internally to make sure the content is visible (and well-spaced) to fit any context/screen.

 is intrinsically responsive. That is, it will wrap and reconfigure

You may feel compelled to add
overrides” and

Every
Layout

 primitives do not depend on them.

@media

 query breakpoints, but these are considered “manual

Without primitive data types, you would have to be constantly teaching your programming
meaningful
language how to do basic operations. You would quickly lose sight of the specific,
task you set out to accomplish with the language in the first place. A design system that does
not leverage primitives is similarly problematic. If every component in your pattern library follows
its own rules for layout, inefficiencies and inconsistencies will abound.

The primitives each have a simple responsibility:
evenly" "separate
elements
horizontally"
parents, children, or siblings of one another.

,

"space
elements
vertically" "pad
elements

,

, etc. They are designed to be used in composition, as

You probably cannot create
 alone. But you
can certainly make most, if not all, common web layouts, and achieve many of your own unique
conceptions.

Every
Layout's primitives

 every layout using

literally

In any case, you should walk away with an understanding and appreciation for the benefits of
composition, and the power to create all sorts of interfaces with just a little reusable code. The
English alphabet is only 26 bytes, and think of all the great works created with that!

Units

Everything you see on the web is composed out of the little dots of light that make up your
device’s screen:
. So, when measuring out the artefacts that make up our interfaces,
thinking in terms of pixels, and using the CSS

 unit, makes sense. Or does it?

pixels

px

pixel geometries vary wildly
↗

, and most modern displays employ sub-pixel rendering,
Screens’
which is the manipulation of the color components of individual pixels, to smooth jagged edges
and produce a higher
portrayed.

 is fuzzier than how it’s often

 resolution. The notion of

perceived

1px

The
Samsung
Galaxy
Tab
S
10.5
alternates
the
arrangement
of
subpixels
between
pixels.
Every
other
pixel
is
composed
differently.

1px

Screen resolutions—how many pixels screens pack—also differ. Consequently, while one “CSS
pixel” (
screen, a high resolution screen may proffer
 pixels.
are pixels, and then there are pixels

 in CSS) may approximate one “device” or “hardware” pixel on a lower resolution

 device pixels for each

 of CSS. So there

multiple

1px

of

Suffice it to say that, while screens are indeed made up of pixels, pixels are not regular,
immutable, or constant. A
 is simply not
 even before they activated zoom.
CSS pixels. It may not have been

 box viewed by a user browsing
device
pixels

zoomed
in

400px

400px

 in

400px

 in

Working with the
it encourages us to labour under a false premise: that
desirable.

 unit in CSS is not

incorrect

px

 as such; you won’t see any error messages. But
 is both attainable and

pixel perfection
↗

Scaling	and	accessibility

px

Designing using the
manifest limitations as well. For one, when you set your fonts using
want to
settings is disregarded.

 unit doesn’t only encourage us to adopt the wrong mindset: there are
, browsers assume you
 the fonts at that size. Accordingly, the font size chosen by the user in their browser

fix

px

With modern browsers now supporting
zoomed proportionately), this is often blown off as a solved problem. However, as
discovered
↗
there are users of the browsers Edge or Internet Explorer. That is: disregarding users who adjust
their default font size is as impactful as disregarding whole browsers.

Evan Minto
, there are more users who adjust their default font size in browser settings than

 (where everything, including text is

full page zoom
↗

,

,

ex

, and

em rem ch

 present no such problem because they are all units

The units
 to the
user’s default font size, as set in their operating system and/or browser. Browsers translate
values using these units into pixels, of course, but in such a way that’s sensitive to context and
configuration. Relative units are arbitrators.

relative

Relativity

Browsers and operating systems typically only afford users the ability to adapt the
font size. This can be expressed as
elements should always be
explicitly, because it’s the default value.

, because they represent body text. You don’t need to set

: exactly one times the root font size. Your paragraph

base

1rem

1rem

1rem

 or

body

:root	{
		/*	↓	redundant	*/
		font-size:	1rem;
}

p	{
		/*	↓	also	redundant	*/
		font-size:	1rem;
}

Elements, like headings, should be set
might be

, for example.

2.5rem

relatively

 larger — otherwise hierarchy will be lost. My

<h2>

h2	{
		/*	↓	2.5	×	the	root	font-size	*/
		font-size:	2.5rem;
}

, and

,
margin padding

,
,
em rem ch
, and

While the units
the
medium, and these units are a convenient and constant reminder of this fact. Learn to
extrapolate your layouts from your text’s intrinsic dimensions and your designs will be beautiful.

 are all measurements of text, they can of course be applied to
ex
 properties (among others). It’s just that text is the basis of the web

border

⚠		Needless	conversion

A lot of folks busy themselves converting between
use equates to a whole pixel value. For example, if the base size is
.

 would be

2.43rem

38.88px

, but

 and

39px

rem

px

, making sure each

rem

 value they

16px 2.4375rem

,

 would be

There’s no need to do precise conversion, since browsers employ sub-pixel rendering and/or
rounding to even things out automatically. It’s less verbose to use simple fractions like
.
Modular
scale

 do the heavy lifting in your

1.25rem 1.5rem 1.75rem

, etc — or to let

calc()

,

,

Proportionality	and	maintainability

 is 2.5 times the root/base size. If I enlarge the root size, my  —and all the other
. The upshot is that

-based multiples—will be enlarged

<h2>
proportionately

rem

<h2>

My
dimensions set in
scaling the entire interface is trivial:

@media	(min-width:	960px)	{
		:root	{
				/*	↓	Upscale	by	25%	at	960px	*/
				font-size:	125%;
		}
}

If I had instead adopted

px

, the implications for maintenance would be clear: the lack of relative

and proportional sizing would require adjusting individual elements case-by-case.

h3	{
		font-size:	32px;
}
h2	{
		font-size:	40px;
}

@media	(min-width:	960px)	{
		h3	{
				font-size:	40px;
		}
		h2	{
				font-size:	48px;
		}
		/*	etc	etc	ad	nauseum	*/
}

Viewport	units

Every
Layout

, we eschew width-based

In
layout reconfigurations, and are not sensitive to the immediate available space actually afforded
the element or component in question. Scaling the interface at a discrete
last example, is arbitrary. What’s so special about
acceptable at

, as in the
? Can we really say the smaller size is

 queries. They represent the hard coding of

breakpoint

@media

959px

960px

?

A

1px

disparity
represents
a
significant

jump

when
using
a
breakpoint.

 are relative to the browser viewport’s size. For example,

Viewport units
↗
the screen’s width, and
we can create an algorithm whereby dimensions are scaled proportionately, but from a
value.

 is equal to 1% of the screen’s height. Using viewport units and

1vw

1vh

 is equal to 1% of

calc()
minimum

:root	{
		font-size:	calc(1rem	+	0.5vw);
}

1rem

 part of the equation ensures the

The
(system/browser/user defined) value. That is,

 never drops
.
 is

1rem

1rem	+	0vw

font-size

below

 the default

The

em

	unit

em

 unit is to the

The
immediate context rather than the outer document. If I wanted to slightly enlarge a
, I could use
element’s

container query
↗

 unit what a

 within my

 is to a

font-size

 units:

@media

<h2>

rem

em

 query. It pertains to the

<strong>

h2	{
		font-size:	2.5rem;
}

h2	strong	{
		font-size:	1.125em;
}

’s

<strong>

The
font-size
instead, it wouldn’t scale with its parent
the

 CSS value as well.

 is now

h2	strong

1.125	×	2.5rem

, or

2.53125rem

<h2>

: if I changed the

. If I set a

rem

 value for the
<strong>
 value, I would have to change

h2

As a rule of thumb,
elements.
or supplant text.

em

 units are better for sizing inline elements, and

 units are better for block
-based sizing, since they either accompany

rem

SVG icons are perfect candidates
↗ em

 for

The
actual
value,
in

ems

,
of
the
icon
height/width
must
be
adapted
to
the
accompanying
font’s
own
metrics,
in
some
cases.
The

Barlow
Condensed
font
used
on
this
site
has
a
lot
of
internal
space
to
compensate
for
—
hence
the

0.75rem

value.

The

ch

	and

ex

	units

The

ch

 and

ex

 units pertain to the (approximate) width and height of one character respectively.

1ch
known as the

 is based on the width of a  , and

 is equal to the
1ex
x height or corpus size
↗
.

0

height

 of your font’s   character—also
x

Axioms

 section, the

In the
measure is a question of characters per line,
for this styling task.

ch

 unit is used to restrict elements’

ch

 (short for

character

measure
↗

 for readability. Since
) is the only appropriate unit

An

<h2>

 and an

<h3>

 can have different

font-size

 values, but the same (maximum) measure.

h2,
h3	{
		max-inline-size:	60ch;
}

h3	{
		font-size:	2rem;
}
h2	{
		font-size:	2.5rem;
}

font-size

The width, in pixels, of one full line of text is
-based
based
rather than hard coding it as a
layout terms, an error is malformed or obscured content:

max-width
-based

extrapolated

 and

width

ch

px

rem
. By delegating an algorithm to determine this value—

 from the relationship between the

-

—we avoid frequent and serious error. In CSS

data
loss
for
human
beings
.

Global	and	local	styling

Composition

 section we covered how small,

In the
used to create larger composites, but not all styles within an efficient and consistent CSS-based
design system should be strictly component based. This section will contextualize layout
components in a larger system that includes global styles.

 components for layout can be

nonlexical

What	are	global	styles?

When people talk about the
They may be referring to rules on the
a few exceptions).

global

 nature of CSS, they can mean one of a few different things.

:root

 or

<body>

 elements that are

inherited

 globally (with just

:root	{
		/*	↓	Now	(almost)	all	elements	display	a	sans-serif	font	*/
		font-family:	sans-serif;
}

Alternatively, they may mean using the unqualified
 selector
↗
*

 to style all elements

directly

.

*	{
		/*	↓	Now	literally	all	elements	display	a	sans-serif	font	*/
		font-family:	sans-serif;
}

Element selectors are more specific, and only target the elements they name. But they are still
“global” because they can

 those elements wherever they are situated.

reach

p	{
		/*	↓	Wherever	you	put	a	paragraph,	it’ll	be	sans-serif	*/
		font-family:	sans-serif;
}

A liberal use of element selectors is the hallmark of a comprehensive design system. Element
selectors take care of generic
 such as headings, paragraphs, links, and buttons. Unlike
when using classes (see below), element selectors can target the arbitrary, unattributed content
produced by

WYSIWYG editors
↗

markdown
↗
.

atoms
↗

 and

 of

layouts

Every
Layout

The
you to decide. It is the imbrication of simple elements into composite layouts that we are
interested in here.

 do not explore or prescribe styles for simple elements; that is for

Each
layout
requires
a
container
element
which
establishes
a

formatting
context

for
its
children.
Simple
elements,
without
children

for
which
they
establish
a
context,
can
be
thought
of
as
'end
nodes'
in
the
layout
hierarchy.

Finally, class-based styles, once defined, can be adhered to any HTML element, anywhere in a
document. These are more portable and composable than element styles, but require the author
to affect the markup directly.

.sans-serif	{
		font-family:	sans-serif;
}

<div	class="sans-serif">...</div>

<small	class="sans-serif">...</small>

<h2	class="sans-serif">...</h2>

It should be appreciated how important it is to leverage the global reach of CSS rules. CSS itself
exists
 to enable the styling of HTML globally, and by category, rather than element-by-element.
When used as intended, it is the most efficient way to create any kind of layout or aesthetic on
the web. Where global styling techniques (such as the ones above) are used appropriately, it’s
much easier to separate branding/aesthetic from layout, and treat the two as

separate concerns

↗

.

Utility	classes

As we already stated, classes differ from the other global styling methods in terms of their
portability: you can use classes between different HTML elements and their types. This allows us
to

 from inherited, universal, and element styles

globally
.

diverge

For example, all of our

<h2>

 elements may be styled, by default, with a

2.25rem font-size

:

h2	{
		font-size:	2.25rem;
}

h3	{
		font-size:	1.75rem;
}

However, there may be a specific cases where we want that
 to be diminished slightly
(perhaps horizontal space is at a premium, or the heading is somewhere where it should have
 element to affect this visual change, we
less visual affordance). If we were to switch to an
<h3>
make a nonsense of the document structure
↗
.
would

font-size

Instead, we could build a more complex selector pertaining to the smaller

<h2>

’s context:

.sidebar	h2	{
		font-size:	1.75rem;
}

While this is better than messing up the document structure, I've made the mistake of not taking
the
 emerging system into consideration: We've solved the problem for a specific element,
in a specific context, when we should be solving the general problem (needing to adjust

whole

font-

size

) for

any

 element in

any

 context. This is where utility classes come in.

/*	↓	Backslash	to	escape	the	colon	*/
.font-size\:base	{
		font-size:	1rem;
}

.font-size\:biggish	{
		font-size:	1.75rem;
}

.font-size\:big	{
		font-size:	2.25rem;
}

We use a very

on
the
nose

 naming convention, which emulates CSS declaration structure:
. This helps with recollection of utility class names, especially where the value

property-name:value
echos the actual value, like

.text-align:center

.

Sharing values between elements and utilities is a job for
made the custom properties themselves globally available by attaching them to the
element:

custom properties
↗

. Note that we’ve

)
 (
:root <html>

:root	{
		--font-size-base:	1rem;
		--font-size-biggish:	1.75rem;
		--font-size-big:	2.25rem;
}

/*	elements	*/

h3	{
		font-size:	var(--font-size-biggish);
}
h2	{
		font-size:	var(--font-size-big);
}

/*	utilities	*/

.font-size\:base	{
		font-size:	var(--font-size-base)	!important;
}

.font-size\:biggish	{
		font-size:	var(--font-size-biggish)	!important;
}

.font-size\:big	{
		font-size:	var(--font-size-big)	!important;
}

Each utility class has an
adjustments, and should not be overridden by anything that comes before them.

 suffix to max out its specificity. Utility classes are for final

!important

Sensible
CSS
architecture
has
“reach”
(how
many
elements
are
affected)
inversely
proportional
to
specificity
(how
complex
the
selectors
are).
This
was
formalized
by
Harry
Roberts
as
ITCSS,
with
IT
standing
for
Inverted
Triangle.

The values in the previous example are just for illustration. For consistency across the design,
your sizes should probably be derived from a modular scale. See

Modular
scale

 for more.

⚠		Too	many	utility	classes

One thing we highly recommend is
want to send users any unused or redundant data. For this project, we maintain a
file and add utilities as we find ourselves reaching for them. If we find the
class isn’t taking effect, we must not have added it in the CSS yet — so we put it in our

 including utility classes until you need them. You don’t

text-align:center

helpers.css

not

helpers.css

 file for present and future use.

utility first
↗

In a
 approach to CSS, inherited, universal, and element styles are not really
leveraged at all. Instead, combinations of individual styles are applied on a case-by-case
Tailwind utility-first framework
↗
basis to individual and independent elements. Using the
might result—as exemplified by Tailwind's own documentation—in class values like the
following:

 this

class="rounded-lg	px-4	md:px-5	xl:px-4	py-3	md:py-4	xl:py-3	bg-teal-500	hover:bg-teal-600
md:text-lg	xl:text-base	text-white	font-semibold	leading-tight	shadow-md"

There may be reasons, under specific circumstances, why one might want to go this way.
Perhaps there is a great deal of detail and disparity in the visual design that benefits from
having this kind of granular control, or perhaps you want to prototype something quickly
without context switching between CSS and HTML.
's approach assumes you
want to create robustness and consistency with the minimum of manual intervention. Hence,
the concepts and techniques laid out here leverage
algorithms that extrapolate from them instead.

, primitives, and the styling

Every
Layout

axioms

Local	or	'scoped'	styles

id

 attribute/property (for

Notably, the
used on one HTML element per document. Styling via the
instance.

reasons of accessibility
↗

id

, most importantly) can only be
 selector is therefore limited to one

#unique	{
		/*	↓	Only	styles	id="unique"	*/
		font-family:	sans-serif;
}

id

 selector has a very high

The
override competing generic styles in all cases.

specificity
↗

 because it’s assumed unique styles are intended to

Of course, there’s nothing more “local” or
 attribute/property:
elements using the

style

instance
specific

 than applying styles directly to

<p	style="font-family:	sans-serif">...</p>

The only remaining

standard

 for localizing styles is within Shadow DOM. By making an element a

shadowRoot

, one can use low-specificity selectors that only affect elements inside that parent.

const	elem	=	document.querySelector('div');
const	shadowRoot	=	elem.attachShadow({mode:	'open'});
shadowRoot.innerHTML	=	`
		<style>
				p	{
						/*	↓	Only	styles	<p>s	inside	the	element’s	Shadow	DOM	*/
						font-family:	sans-serif;
				}
		</style>
		<p>A	sans-serif	paragraph</p>
`;

Drawbacks

The

id

 selector, inline styles, and Shadow DOM all have drawbacks:

 Many find the high specificity to cause systemic issues. There’s also the

’s name in each case. Dynamically generating a unique

 A maintenance nightmare, which is the reason CSS was antidotally conceived

id

selectors:

id
necessity of coming up with the
string is often preferable.
Inline
styles:
in the first place.
Shadow
DOM:
but (most) styles are not permitted to get
global styling.

 Not only are styles prevented from “leaking out” of the Shadow DOM root,

in

 either — meaning you can no longer leverage

What we need is a way to simultaneously leverage global styling, but apply local,
specific

 styles in a controlled fashion.

instance-

Primitives	and	props

Composition

As set out in
 that
help to arrange elements/boxes together. These are the primary tools for eliciting layout and take
their place between generic global styles and utilities.

, the main focus of

 is on the simple

layout primitives

Every
Layout

1.  Universal (including inherited) styles
2.  Layout primitives
3.  Utility classes

Manifested as reusable components, using the
configurations
can be used globally. But unique
(properties).

custom elements specification
↗
 of these layouts are possible using props

, these layouts

Interoperability

Every
Layout

Custom elements are used in place of React, Preact, or Vue components (which all also use
props) in
application frameworks. Each
CSS code needed to achieve the layout. You can use this to create a Vue-specific layout
primitive (for example) instead.

 also comes with a code generator to produce just the

 because they are native, and can be used

 different web

across

layout

Defaults

Each layout component has an accompanying stylesheet that defines its basic and default
styles. For example, the

) looks like the following.

 stylesheet (

Stack.css

Stack

stack-l	{
		display:	block;
}

stack-l	>	*	+	*	{
		margin-top:	var(--s1);
}

A few things to note:

Boxes

margin-top

display:	block

 declaration is necessary since custom elements render as inline elements

 value is what makes the

 for more information on block and inline element behavior.

The
by default. See
The
stack of elements. By default, that margin value matches the first point on our
scale --s1
:
The   selector applies to any element, but our use of  is qualified to match any
child element of a
a composition in abstract, and should not prescribe the content, so I use   to match any
child element types given to it.

*
adjacent sibling combinator
↗

: it inserts margin between a vertical

). The layout primitive is

Stack stack
 a

successive

 (note the

modular

<stack-l>

*

*

.

In the custom element definition itself, we apply the default value to the

space

 property:

get	space()	{
		return	this.getAttribute('space')	||	'var(--s1)';
}

Each

Every
Layout

 custom element builds an embedded stylesheet based on the instance’s

property values. That is, this…

<stack-l	space="var(--s3)">
		<div>...</div>
		<div>...</div>
		<div>...</div>
</stack-l>

…would become this…

<stack-l	data-i="Stack-var(--s3)"	space="var(--s3)">
		<div>...</div>
		<div>...</div>
		<div>...</div>
</stack-l>

… and would generate this:

<style	id="Stack-var(--s3)">
		[data-i='Stack-var(--s3)']	>	*	+	*	{
				margin-top:	var(--s3);
		}
</style>

However—and this part is important—the
configuration
used to serve all instances of

<stack-l>

 for a layout, not a unique instance. One

Stack-var(--s3)

 string only represents a unique

id="Stack-var(--s3)" <style>

 element is

 sharing the configuration represented by the

Stack-var(--

 string. Between instances of the same configuration, the only thing that

really

 differentiates

s3)
them is their

content
.

While each item of content within a web page should generally offer unique information, the
and
feel
 should be consistent and regular, using familiar and repeated patterns, motifs, and
arrangements. Leveraging global styles along with controlled layout configurations results in
consistency and cohesion, and with minimal code.

look

Modular	scale

Music is fundamentally a mathematical exposition, and when we talk about
typesetting
↗

 it is because typesetting and music share a mathematical basis.

the musicality of

We’re sure you will have heard of concepts like frequency, pitch, and harmony. These are all
mathematically determinable, but were you aware that perceived pitch can be formed of multiple
frequencies?

A single musical note, such as one produced by plucking a guitar string, is in itself a
composition. The different frequencies (or harmonics) together belong to a harmonic series. A
harmonic series is a sequence of fractions based on the arithmetic series of incrementation by 1.

1,2,3,4,5,6	//	arithmetic	series
1,½,⅓,¼,⅕,⅙	//	harmonic	series

The resulting sound is harmonious because of its regularity. The fundamental frequency is
divisible by each of the harmonic frequencies, and each harmonic frequency is the mean of the
frequencies either side of it.

Visual	harmony

We should aim for harmony in our visual layout too. Like the sound of a plucked string, it should
be cohesive. Given we’re working predominantly with text, it’s sensible to treat the
a basis for extrapolating values for white space. A font-size of (implicitly)
of 1.5 creates a default value of

1rem
. A harmoniously larger space might be

 (2 ⨉ 1.5) or

line-height

line-height

, and a

1.5rem

3rem

 as

4.5rem

 (3 ⨉ 1.5).

Creating a sequence by adding 1.5 at each step results in large intervals. Instead, we can
multiply by 1.5. The result is still regular; the increments just smaller.

1	*	1.5;	//	1.5
1.5	*	1.5;	//	2.25
1.5	*	1.5	*	1.5;	//	3.375

This algorithm is called a modular scale, and like a musical scale is intended for producing
harmony. How you employ it in your design depends on what technology you are using.

Custom	properties

In CSS, you can describe a modular scale using custom properties and the
which supports simple arithmetic.

calc()

 function,

In the following example, we divide or multiply by the set
 custom property (variable) to
create the points on our scale. We can make use of already set points to generate new ones.
That is,

.
var(--ratio)	*	var(--ratio)	*	var(--ratio)

var(--s2)	*	var(--ratio)

 is equivalent to

--ratio

:root	{
		--ratio:	1.5;
		--s-5:	calc(var(--s-4)	/	var(--ratio));
		--s-4:	calc(var(--s-3)	/	var(--ratio));
		--s-3:	calc(var(--s-2)	/	var(--ratio));
		--s-2:	calc(var(--s-1)	/	var(--ratio));
		--s-1:	calc(var(--s0)	/	var(--ratio));
		--s0:	1rem;
		--s1:	calc(var(--s0)	*	var(--ratio));
		--s2:	calc(var(--s1)	*	var(--ratio));
		--s3:	calc(var(--s2)	*	var(--ratio));
		--s4:	calc(var(--s3)	*	var(--ratio));
		--s5:	calc(var(--s4)	*	var(--ratio));
}

Note
the
curved
incline
observable
when
connecting
the
top
left
corners
of
squares
representing
points
on
the
scale

The

pow()

	function

At the time of writing, browsers only support basic arithmetic in
new suite of mathematical functions/expressions
↗
includes the
much easier.

pow()

calc()

 operations. However, a

 are coming to CSS. Crucially, this

 function, with which accessing and creating modular scale points becomes

:root	{
		--ratio:	1.5rem;
}

.my-element	{
		/*	↓	1.5	*	1.5	*	1.5	is	equal	to	1.5³	*/
		font-size:	pow(var(--ratio),	3);
}

JavaScript	access

Our scale variables are placed on the
truly
global, we mean
Shadow DOM boundaries to affect the CSS of a

:root

 global. Custom properties are available to JavaScript and also “pierce”

 element, making them globally available. And by

shadowRoot

 stylesheet.

JavaScript consumes CSS custom properties like JSON properties. You can think of global
custom properties as configurations shared by CSS and JavaScript. Here’s how you would get
the

 point on the scale using JavaScript (

document.documentElement

 represents the

, or

:root

--s3

<html>

 element):

const	rootStyles	=	getComputedStyle(document.documentElement);
const	scale3	=	rootStyles.getPropertyValue('--s3');

Shadow	DOM	support

The same
--s3
following example. The

 property is successfully applied when invoked in Shadow DOM, as in the

:host

 selector refers to the hypothetical custom element itself.

this.shadowRoot.innerHTML	=	`
		<style>
				:host	{
						padding:	var(--s3);
				}
		</style>
		<slot></slot>
`;

Passing	via	props

Sometimes we might want our custom element to consume certain styles from properties (
— in this case a

 prop.

padding

props
)

<my-element	padding="var(--s3)">
		<!--	Light	DOM	contents	-->
</my-element>

The
var(--s3)
template literal
↗
:

 string can be interpolated into the custom element instance's CSS using a

this.shadowRoot.innerHTML	=	`
		<style>
				:host	{
						padding:	${this.padding};
				}
		</style>
		<slot></slot>
`;

But first we need to write a getter and a setter for our
getter’s
components less laborious; we’re aiming for

 line is the

default

return

 value. Use of sensible defaults makes working with layout
convention over configuration
↗
.

padding

 prop. The

||	var(--s1)

 suffix in the

		get	padding()	{
				return	this.getAttribute('padding')	||	'var(--s1)';
		}

		set	padding(val)	{
				return	this.setAttribute('padding',	val);
		}

⚠		Eschewing	Shadow	DOM

The custom elements used to implement
because they are designed to more fully leverage 'global' styles. See
for more information.

Every
Layout's layouts

 do not use Shadow DOM

Global
and
local
styling

Not using Shadow DOM also makes it easier to server-side render the embedded styles. The
initial
meaning
dynamic processing of their values in developer tools, or via your own custom scripting.

 is embedded into the document as part of the build process,
 for the

 custom elements are not dependent on JavaScript,

 styling of any one
Every
Layout's

except

layout

Enforcing	consistency

This
padding
length value like

 prop is currently permissive; the author can supply a custom property, or a simple

1.25rem

. If we wanted to enforce the use of our modular scale, we would accept

only numbers ( ,  ,

2 3 -1

) and interpolate them like

var(--${this.padding})

.

We could check that an integer value is being passed using a regular expression. HTML attribute
values are implicitly strings. We are looking for a single digit string containing a number.

if	(!/(?<!\S)\d(?!\S)/.test(this.padding))	{
		console.error('<my-component>’s	padding	value	should	be	a	number	representing	a	point	on	the
modular	scale');
		return;
}

The modular scale is predicated on a single number, in this case
a multiplier and divisor—the number’s presence can be felt throughout the visual design.
Consistent, balanced design is seeded by simple

 like the modular scale ratio.

axioms

. Through extrapolation—as

1.5

Some believe the specific ratio used for one’s modular scale is important, with many adhering to
the
 ratio you choose
that harmony is created.

. But it is in the strict adherence to

golden ratio
↗ 1.61803398875
 of

whichever

Axioms

the mathematician Euclid was aware
↗

As
simple, irreducible axioms (or
will be inconsistent and malformed. The subject of this section is how to honor a design axiom
system-wide, using

, even the most complex geometries are founded on
). Unless your design is founded on axioms, your output

typographic
measure

 as an exemplar.

postulates

Measure

measure
↗
The width of a line of text, in characters, is known as its
measure is critical for the comfortable scanning of successive lines.
Typographic Style
↗

 considers any value between 45 and 75 reasonable.

. Choosing a
The Elements Of

reasonable

Setting a measure for print media is relatively straightforward. It is simply the width of the paper
margins and gutters
↗
artefact divided by the number of text columns placed within it — minus
,
of course.

The web is not static or predictable like print. Each word is separated by a breaking space
unicode point U+0020
↗
(
), freeing runs of text to wrap dynamically according to available space.
The amount of available space is determined by a number of interrelated factors including device
size and orientation, text size, and zoom level.

As designers, we seek to control the users’ experience. But, as John Allsopp wrote in 2000’s
Dao Of Web Design
↗
 control over the way users consume content on the
web is foolhardy. Enforcing a specific measure would mean setting a fixed width. Many users
would experience horizontal scrolling and broken zoom functionality.

, attempting

direct

The

To design “adaptable pages” (Allsopp’s term), we must relinquish control to the algorithms (like
text wrapping) browsers use to lay out web pages automatically. But that’s not to say there’s no
place for
manager.

 layout. Think of yourself as the browser’s mentor, rather than its micro-

influencing

The	measure	axiom

It’s good practice to try and set out a design axiom in a short phrase or sentence. In this case
that statement might be,

“the
measure
should
never
exceed
60ch”
.

The measure of what? And where? There’s no reason why
lengthy. This axiom, like all axioms, should pervade the design without qualifications or
exceptions. The real question is: how? In
styling:

Global
and
local
styling

any

 line of text should become too

 we set out three main tiers of

1.  Universal (including inherited) styles
2.  Layout primitives
3.  Utility classes

The measure axiom should be seeded as pervasively as possible in the universal styles, but also
made available to layout primitives (see
property and which value should inscribe the rule?

. But first, which

Composition

utility classes

) and

The	declaration

Fixed widths (and heights!) are anathema to responsive design, as we established in
tolerances
again here. Instead, we should deal in
tolerates any length of text, in any writing mode,

max-inline-size
 a certain value.

. The
up
to

 property, for example,

Boxes

 and

p	{
		max-inline-size:	700px;
}

That’s the property covered. However, the
eye, that
700px
really just the
of our own design.

font-size

 creates a reasonable measure for the given

px

 unit is problematic. We may be able to judge, by
 is

. But the given

font-size

font-size

 our screen happens to be displaying at the time — it’s our parochial view

font-size

 for paragraphs, or adjusting the default system font size, will create a

Changing
different (maximum) measure. Because there is no
pixel width, we do not have an algorithm that can guarantee the correct maximum measure
value.

 between character length and

relationship

Fortunately, CSS includes the
character. Importantly, this means changing the
adapting the measure. Using
the outcome is predicated on a calculation you permit the browser to make for you.

 changes the value of

 unit. The value of

 units is an innately algorithmic approach to measure, because

 is based on the width of the font’s
0

, thereby

font-size

1ch

1ch

ch

ch

ch

 enables us to enforce the axiom independent of

Using
"the
measure
should
never
exceed
60ch"
pervasive and in no danger of “going wrong”. Where
might have been a note in some documentation, it can instead be a quality directly coded into
the design’s character.

, allowing it to be highly

font-size

Designing	without	seeing

Designing	without	seeing

Designing by axiom requires something of a mental shift. Axioms do not directly create visual
artefacts, only the characteristics of artefacts that might emerge.

Sometimes the resulting artefacts look and behave in ways that you might not have foreseen.
For example, in a container which is wider than the agreed measure as applied to the base
font size, elements with different font sizes will take up different proportions of that container's
width. This is because

 is wider for a larger font size.

1ch

At the time of conceiving the axiom, you may not have pictured this specific visual effect. But
that’s not to say it isn’t sound or desirable. In fact, it’s your CSS doing exactly as you
intended: maintaining a reasonable measure irrespective of the context.

Fundamentally, designing for the web is designing
all of the visual combinations produced by

without
seeing

. You simply can’t anticipate

1.  The modular placement of your layout components
2.  The circumstances and settings of each end user’s setup

Instead of thinking of designing for the web as creating visual artefacts, think of it as writing
programs
 visual artefacts. Axioms are the rules that influence how those
artefacts are created by the browser, and the better thought out they are the better the
browser can accommodate the user.

generating

 for

Global	defaults

To realize the axiom, we need to ensure all applicable elements are subject to it. This is a

question of selectors. We could create a class selector…

.measure-cap	{
		max-inline-size:	60ch;
}

…but it’s a mistake to think in terms of (utility) classes too early. It would mean applying the style
manually, to individual elements in the HTML, wherever we felt it was applicable. Manual
intervention is laborious, prone to error (missing elements out), and will lead to bloated markup.

Instead, we should ask ourselves which
elements designed for text. Inline elements like
since they would take up only a part of their parent flow elements’ total measure.

 of elements the rule might apply to. Certainly flow
 would not need to be included,

types

<small>

 and

<em>

p,
h1,
h2,
h3,
h4,
h5,
h6,
li,
figcaption	{
		max-inline-size:	60ch;
}

Exception-based	styling

It’s difficult to know if we’ve remembered everything here. An exception based approach is
smarter, since we only have to remember which elements should
that inline elements
equal or lesser horizontal space than their parents, no ill effects would emerge.

 be subject to the rule. Note
 be included in the following example but, since they would take up an

would

not

*	{
		max-inline-size:	60ch;
}

html,
body,
div,
header,
nav,
main,
footer	{
		max-inline-size:	none;
}

 element particularly tends to be used as a generic container/wrapper. It’s likely some

<div>

The
of these elements will contain multiple adjacent
up the full

60ch

. This makes their parents logical exceptions.

boxes

, with one or more of each wishing to take

An exception-based approach to CSS lets us do

most

 of our styling with the

least

 of our code. If

you are not taking an exception-based approach, it may be because making exceptions feels
cascade and other features
like

. But this is far from the case. CSS, with its

correcting
mistakes

, is designed for this. In Harry Roberts’

↗
(how specific selectors are) is inversely proportional to reach (how many elements they should
affect).

ITCSS (Inverted Triangle CSS)
↗

 thesis, specificity

A	universal	value

Before we start using the measure value everywhere, we’d best define it as a custom property.
That way, any change to the value will be propagated throughout the design.

Note that not all custom properties have to be global, but in this case we want our elements,
props, and utility classes to agree. Therefore, we place the custom property on the
element.

:root

:root	{
		--measure:	60ch;
}

This is passed into our universal block…

*	{
		max-inline-size:	var(--measure);
}

html,
body,
div,
header,
nav,
main,
footer	{
		max-inline-size:	none;
}

…and to any utility classes we may find we need.

.max-inline-size\:measure	{
		max-inline-size:	var(--measure);
}

.max-inline-size\:measure\/2	{
		max-inline-size:	calc(var(--measure)	/	2);
}

Escaping

The backslashes are required in the previous example to escape the special forward slash and
colon characters.

Measure	in	composite	layouts

layout primitives

Certain
for those props using
Switcher
container width at which the layout switches between a horizontal and vertical configuration:

 inevitably accept measure-related props, and some set default values

 prop that defines the

var(--measure)

threshold

 has a

. The

get	threshold()	{
		return	this.getAttribute('threshold')	||	'var(--measure)';
}

set	threshold(val)	{
		return	this.setAttribute('threshold',	val);
}

This is a sensible default, but can easily be overridden with any string value:

<switcher-l	threshold="20rem">...</switcher-l>

If we pass an illegitimate value to
fallback stylesheet will apply the default value anyway. Here’s what that stylesheet looks like:

, the declaration will be dropped, and the

threshold

Switcher’s

switcher-l	{
		display:	flex;
		flex-wrap:	wrap;
}

switcher-l	>	*	{
		flex-basis:	calc((var(--measure)	-	100%)	*	999);
		flex-grow:	1;
}

Our approach to measure is one where we assume control, but a tempered kind of control that's
deferential towards the way browsers work and users operate them. Many of the 'axioms' that
"the
body
font
will
be
Font
X"
govern your design, like
have an impact on layout as such, making them much simpler to apply just with
When layout comes into the equation, be wary of differing configurations and orientations.
Choose properties, values, and units that enable the browser to calculate the most suitable
layout on your behalf.

 will not
global styles
.

"headings
will
be
dark
blue"

 or

The	Stack

The	problem

Flow elements require space (sometimes referred to as
conceptually separate them from the elements that come before and after them. This is the
purpose of the

) to physically and

white
space

 property.

margin

However, design systems conceive elements and components in isolation. At the time of
conception, it is not settled whether there will be surrounding content or what the nature of that
content will be. One element or component is likely to appear in different contexts, and the
requirement for spacing will differ.

We are in the habit of styling elements, or classes of elements, directly: we make style
declarations
a property of the
problematic:

 is really
 between two proximate elements. The following code is therefore

 to elements. Typically, this does not produce any issues, but

relationship

belong

margin

p	{
		margin-bottom:	1.5rem;
}

Since the declaration is not context sensitive, any correct application of the margin is a matter of
luck. If the paragraph is proceeded by another element, the effect is desirable. But a
:last-child
paragraph produces a redundant margin. Inside a padded parent element, this redundant margin
combines with the parent’s padding to produce double the intended space. This is just one
problem this approach produces.

The	solution

The trick is to style the context, not the individual element(s). The
margin between elements via their common parent:

Stack

 layout primitive injects

.stack	>	*	+	*	{
		margin-block-start:	1.5rem;
}

Using the adjacent sibling combinator ( ),
preceded by another element: no “left over” margin. The universal (or
ensures any and all elements are affected. The key

+ margin-block-start

*	+	*

 construct is known as the

wildcard

) selector ( )
*
owl
↗
.

 is only applied where the element is

Line	height	and	modular	scale

In the previous example, we used a
using this value because it reflects our (usually preferred) body text

margin-block-start

 value of

1.5rem

. We’re in the habit of
 of

line-height

1.5

.

The vertical spacing of your design should be based on your standard
line-height
text dominates most pages’ layout, making one line of text a natural denominator.

 because

line-height

If the body text
 (i.e.
ratio for your modular scale. Read the
expressed with CSS custom properties.

 is

1.5

1.5

 ⨉ the

font-size

), it makes sense to use

1.5

 as the

introduction to modular scale

, and how it can be

Recursion

In the previous example, the child combinator ( ) ensures the margins only apply to children of
>
the
combinator from the selector.

 element. However, it’s possible to inject margins recursively by removing this

.stack

.stack	*	+	*	{
		margin-block-start:	1.5rem;
}

This can be useful where you want to affect elements at any nesting level, while retaining white
space regularity.

In the following demonstration (using the
shaped elements. Two of these are nested within another. Because recursion is applied, each
box is evenly spaced using just one parent
Stack

 to follow) there are a set of box-

Stack component

.

This interactive demo is only available on the

Every
Layout

 site
↗
.

You’re likely to find the recursive mode affects unwanted elements. For example, generic list
items that are typically not separated by margins will become unexpectedly

spread
out
.

Nested	variants

Recursion applies the same margin no matter the nesting depth. A more deliberate approach
would be to set up alternative non-recursive
where suitable. Consider the following.

 with different margin values, and nest them

Stacks

[class^='stack']	>	*	{
		/*	top	and	bottom	margins	in	horizontal-tb	writing	mode	*/
		margin-block:	0;
}

.stack-large	>	*	+	*	{
		margin-block-start:	3rem;
}

.stack-small	>	*	+	*	{
		margin-block-start:	0.5rem;
}

This interactive demo is only available on the

Every
Layout

 site
↗
.

The first declaration block’s selector resets the vertical margin for all
matching class values that
 with
because the stack only
You may not need this reset if a universal reset for
local
styling

affects

begin

margin

stack

).

-like elements (by
). Importantly, only the vertical margins are reset,

Stack

 vertical margin, and we don't want it to reach outside its remit.

 is already in place (see

Global
and

The following two blocks set up alternative
nested to produce—for example—the illustrated form layout. Be aware that the
would need to have
actually produce spaces (the vertical margin of inline elements has no effect; see
property

display:	block

Stacks

).

 applied to appear above the inputs, and for their margins to

, with different margin values. These can be

The
display

<label>

 elements

Every
Layout

In
Stack
value. The modified classes example above is just for illustration. See the

, custom elements are used to implement layout components/primitives like the
 prop (property; attribute) is used to define the spacing

nested example

.

 component

Stack

, the

space

the

. In

Exceptions

CSS works best as an exception-based language. You write far-reaching rules, then use the

cascade to override these rules in special cases. As written in
CSS Custom Properties
↗
(i.e. at the same nesting level).

, you can create per-element exceptions within a single

Stack

 context

Managing Flow and Rhythm with

.stack	>	*	+	*	{
		margin-block-start:	var(--space,	1.5em);
}

.stack-exception,
.stack-exception	+	*	{
		--space:	3rem;
}

Note that we are applying the increased spacing above
applicable. If you only wanted to increase the space above, you would remove

 below the

.exception

and

 element, where

.
.exception	+	*

This works because   has
specificity and
down in the stylesheet).

*

.stack-exception

zero

 specificity, so
 overrides

.stack	>	*	+	*

 and

.stack-exception

 are the same

.stack	>	*	+	*

 in the cascade (by appearing further

Splitting	the	stack

Stack

By making the
 a Flexbox context, we can give it one final power: the ability to add an
margin to a chosen element. This way, we can group elements to the top and bottom of the
vertical space. Useful for card-like components.

auto

In the following example, we've chosen to group elements
bottom of the space.

after

 the second element towards the

.stack	{
		display:	flex;
		flex-direction:	column;
		justify-content:	flex-start;
}

.stack	>	*	+	*	{
		margin-block-start:	var(--space,	1.5rem);
}

.stack	>	:nth-child(2)	{
		margin-block-end:	auto;
}

Custom	property	placement

Importantly, despite now setting some properties on the parent
setting the
property is set, it will get overridden if the parent becomes a child in nesting (see
variants

 value on the children, not “hoisting” it up. If the parent is where the

, above).

--space

 element, we’re still

Nested

.stack

This can be seen working in context in the following demo depicting a presentation/slides editor.

Cover

 element on the right has a minimum height of

The
height to be taller than its content. This is what produces the gap between the slide images and
the

, forcing the left sidebar's

"Add
slide"

 button.

66.666vh

This interactive demo is only available on the

Every
Layout

 site
↗
.

Where the
Stack
example/demo. A height of
can occur.

 is the only child of its parent, nothing forces it to

stretch

 as in the last

100%

 ensures the

Stack's

 height

matches

 the parent's and the split

.stack:only-child	{
		/*	↓	`height`	in	horizontal-tb	writing	mode	*/
		block-size:	100%;
}

Use	cases

Stack

The potential remit of the
stacked one atop another, it is likely a
as grid cells) should not be subject to a
Stack
.
and the grid itself a member of a
Stack

Stack

 layout can hardly be overestimated. Anywhere elements are

 should be in effect. Only adjacent elements (such
, however,
 likely to be

. The grid cells

Stacks

are

The	generator

The code generator tool is only available in
basic solution, with comments:

the accompanying documentation site
↗

. Here is the

CSS

.stack	{
		/*	↓	The	flex	context	*/
		display:	flex;
		flex-direction:	column;
		justify-content:	flex-start;
}

.stack	>	*	{
		/*	↓	Any	extant	vertical	margins	are	removed	*/
		margin-block:	0;
}

.stack	>	*	+	*	{
		/*	↓	Top	margin	is	only	applied	to	successive	elements	*/
		margin-block-start:	var(--space,	1.5rem;);
}

HTML

<div	class="stack">
		<div><!--	child	--></div>
		<div><!--	child	--></div>
		<div><!--	etc	--></div>
</div>

The	component

A custom element implementation of the Stack is available for

download
↗
.

Props	API

 component to re-render when altered. They
The following props (attributes) will cause the
Stack
can be altered by hand—in browser developer tools—or as the subjects of inherited application
state.

Name

space

Type

string

Default

"var(--s1)"

Description

A CSS

margin

 value

recursive

boolean

false

splitAfter

number

Whether the spaces apply
recursively (i.e. regardless of
nesting level)

The element after which to
the stack with an auto margin

split

Examples

Basic

<stack-l>
		<h2><!--	some	text	--></h2>
		<img	src="path/to/some/image.svg"	/>
		<p><!--	more	text	--></p>
</stack-l>

Nested

<stack-l	space="3rem">
		<h2><!--	heading	label	--></h2>
		<stack-l	space="1.5rem">
				<p><!--	body	text	--></p>
				<p><!--	body	text	--></p>
				<p><!--	body	text	--></p>
		</stack-l>
		<h2><!--	heading	label	--></h2>
		<stack-l	space="1.5rem">
				<p><!--	body	text	--></p>
				<p><!--	body	text	--></p>
				<p><!--	body	text	--></p>
		</stack-l>
</stack-l>

Recursive

<stack-l	recursive>
		<div><!--	first	level	child	--></div>
		<div><!--	first	level	sibling	--></div>
		<div>
				<div><!--	second	level	child	--></div>
				<div><!--	second	level	sibling	--></div>
		</div>
</stack-l>

List	semantics

In some cases, browsers should interpret the
use the following ARIA attribution to achieve this.

Stack

 as a list for screen reader software. You can

<stack-l	role="list">
		<div	role="listitem"><!--	item	1	content	--></div>
		<div	role="listitem"><!--	item	2	content	--></div>
		<div	role="listitem"><!--	item	3	content	--></div>
</stack-l>

The	Box

The	problem

As I established in
Box

Boxes
 layout, encapsulated as a dedicated

Box

 component?

, every rendered element creates a box shape. So what is the use of a

layouts

All the ensuing
they form a composite visual structure. For example, the simple
boxes and inserts vertical margin between them.

 deal in arranging boxes

together

; distributing them in some way such that
 layout takes a number of

Stack

Stack

It is important the
take on other responsibilities, its job description would become a nonsense, and the other layout
primitives within the system wouldn't know how to behave around the

 is given no other purpose than to insert vertical margins. If it started to

Stack

.

In other words, it's a question of
. Just as in computer science, in visual
design it benefits your system to give each working part a dedicated and unique responsibility.
The design emerges through

separating concerns
↗

composition
.

Box

's role within this layout system is to take care of any styles that can be considered

The
intrinsic to individual elements; styles which are not dictated, inherited, or inferred from the meta-
layouts to which an individual element may be subjected. But which styles are these? It feels like
they could be innumerable.

Not necessarily. While some approaches to CSS give you the power (or the
your perspective) to apply any and every style to an individual element, there are plenty of styles
that do not need to be written in this piecemeal way. Styles like

, depending on

font-family color

, and

pain

line-

,

 can all be

height
And they should, because setting these styles on a case-by-case basis is redundant.

 or otherwise applied globally, as set out in

inherited

.
Global
and
local
styling

:root	{
		font-family:	sans-serif;
}

.box	{
		/*	↓	Not	needed	because	the	style	is	inherited	*/
		/*	font-family:	sans-serif;	*/
}

Of course, you are likely to employ more than one
efficient to apply default (or 'base') styles and later make
it is a special case.

font-family

 in your design. But it is more

exceptions

 than to style everything like

Conveniently, global styles tend to be
but not the
creation of a
such. We are building dynamic, responsive wireframes. Aesthetics can be applied on top.

 of the subject element(s). The purpose of this project is to explore the

 specifically, and we are not interested in branding (or aesthetics) as

 related styles — styles that affect the aesthetics

layout
system

proportions

branding

Same
layouts;
different
aesthetics

This limits the number of properties we have to choose from. To reduce this set of potential
properties further, we have to ask ourselves which layout-specific properties are better handled
.Box
by parent or ancestor elements of the simple

The	solution

Box

Margin is applicable to the
Width and height should also be inferred, either by an
calculated by
content held

,
flex-basis flex-grow
inside
Box

flex-shrink

, and

 the

.

, but only as induced by context — as I've already established.

extrinsic

 value (such as the width

 working together) or by the nature of the

Think of it like this: If you don't have anything to put in a box, you don't need a box. If you
have something to put in a box, the best box is one with just enough room and no more.

do

Padding

Padding is different. Padding reaches
Box
After all, CSS affords us

,

 styling option. The question is, how much control over

padding

Box

 is necessary?

padding-top padding-right padding-bottom

,

padding-left

, as well as

 for our
, and

into

 an element; it is introspective. Padding should be a

the

padding

 shorthand.

Remember we are building a layout system, and not an API for creating a layout system. CSS
itself is already the API. The
Why? Because an element with specific (and asymmetrical) padding is not a
; it's something
else trying to solve a more specific problem. More often than not, this problem relates to adding
spacing between elements, which is what
border.

 is for. Margin extends outside the element's

no
sides
at
all
.
Box

 element should have padding on

 sides, or

margin

Box

all

. It is applied to all sides, and has the singular purpose of moving the

Box

padding

 value corresponding to the first point on my

modular
's content away

In the below example, I'm using a
scale
from its edges.

.box	{
		padding:	var(--s1);
}

The	box	model

As set out in
However, this should already be applied to

Boxes

 you will avoid some sizing issues by applying

all

 elements, not just the named

box-sizing:	border-box
Box

.

.

*	{
		box-sizing:	border-box;
}

The	visible	box

Box

A
should typically

 is only really a
show

 if it has a box-like shape. Yes,

Box
 you this. The most common methods use either

all elements are box-shaped

border

 or a

, but a
Box
.
background

Like
to
Stack

,
padding border
 elements, they should be applied contextually, via a parent, like

 should be applied on all sides or none at all. In cases where borders are used

 is in the

margin

separate

. Otherwise, borders will come into contact and 'double up'.

By
applying
a

border-top

value
via
the

*	+	*

selector,
only
borders

between

child
elements
appear.
None
come
into
contact
with

the
parent

Box's

bordered
perimeter.

If you've written CSS before, you've no doubt used
shape. Changing the
background-color
content is still legible. This can be made easier by applying
that

Box

.

 often requires you to change the

background-color

 to create a visual box
 to ensure the

color

color:	inherit

 to any elements inside

.box	{
		padding:	var(--s1);
}

.box	*	{
		color:	inherit;
}

By forcing inheritance, you can change the
on the

 itself. In the following example, I am using an

Box

color

—along with the

.invert

background-color
 class to swap the

—in one place:

color

 and

background-color
dark values in one place.

 properties. Custom properties make it possible to adjust the specific light and

.box	{
		--color-light:	#eee;
		--color-dark:	#222;
		color:	var(--color-dark);
		background-color:	var(--color-light);
		padding:	var(--s1);
}

.box	*	{
		color:	inherit;
}

.box.invert	{
		/*	↓	Dark	becomes	light,	and	light	becomes	dark	*/
		color:	var(--color-light);
		background-color:	var(--color-dark);
}

Filter	inversion

Filter	inversion

In a greyscale design, it is possible to switch between dark-on-light and light-on-dark with a
simple

 declaration. Consider the following code:

filter

.box	{
		--color-light:	hsl(0,	0%,	80%);
		--color-dark:	hsl(0,	0%,	20%);
		color:	var(--color-dark);
		background-color:	var(--color-light);
}

.box.invert	{
		filter:	invert(100%);
}

--color-light

 is as light at

20%

Because
opposites. When
create a

filter:	invert(100%)
light/dark theme switcher
↗

--color-dark

 is dark at

 as
, they are effectively
 is applied, they take each other's places. You can
 with a similar technique.

80%

When hue becomes involved it is inverted as well, and the effect is likely to be less desirable.

In the absence of a border, a
because
transparent

high contrast themes
↗

outline

 the box shape can be restored.

background-color

 is insufficient for describing a box shape. This is

 tend to eliminate backgrounds. However, by employing a

.box	{
		--color-light:	#eee;
		--color-dark:	#222;
		color:	var(--color-dark);
		background-color:	var(--color-light);
		padding:	var(--s1);
		outline:	0.125rem	solid	transparent;
		outline-offset:	-0.125rem;
}

How does this work? When a high contrast theme is not running, the outline is invisible. The

 property also has no impact on layout (it grows out from the element to cover other

outline
elements if present). When

Windows High Contrast Mode is switched on
↗

, it gives the outline a

color and the box is drawn.

The negative
border and no longer increases the box's overall size.

 moves the outline

outline-offset

inside

 the

Box

's perimeter so it behaves like a

Use	cases

The basic, and highly prolific, use case for a
content may appear as a message or 'note' among other, textual flow content, as one
a grid of many, or as the inner wrapper of a positioned dialog element.

 is to group and demarcate some content. This
 in

card
↗

Box

You can also combine just boxes to make some useful compositions. A
Box
element can be made from two sibling boxes, nested inside another, parent

 with a 'header'
Box

.

The	generator

Use this tool to generate basic
tone boxes, including light-on-dark and dark-on-light ('inverted') themes. See the
box

 section for more.

 CSS and HTML. It provides the ability to create basic, two-

The
visible

Box

The code generator tool is only available in
basic solution, with comments:

the accompanying documentation site
↗

. Here is the

CSS

.box	{
		/*	↓	Padding	set	to	the	first	point	on	the	modular	scale	*/
		padding:	var(--s1);
		/*	↓	Assumes	you	have	a	--border-thin	var	*/
		border:	var(--border-thin)	solid;
		/*	↓	Always	apply	the	transparent	outline,	for	high	contrast	mode	*/
		outline:	var(--border-thin)	transparent;
		outline-offset:	calc(var(--border-thin)	*	-1);
		/*	↓	The	light	and	dark	color	vars	*/
		--color-light:	#fff;
		--color-dark:	#000;
		color:	var(--color-dark);
		background-color:	var(--color-light);
}

.box	*	{
		/*	↓	Force	colors	to	inherit	from	the	parent
		and	honor	inversion	(below)	*/
		color:	inherit;
}

.box.invert	{
		/*	↓	The	color	vars	inverted	*/
		color:	var(--color-light);
		background-color:	var(--color-dark);
}

HTML

<div	class="box">
		<--	the	box's	contents	-->
</div>

The	component

A custom element implementation of the Box is available for

download
↗
.

Props	API

The following props (attributes) will cause the
Box
can be altered by hand—in browser developer tools—or as the subjects of inherited application
state.

 component to re-render when altered. They

Name

padding

borderWidth

Type

string

string

Default

"var(--s1)"

Description

A CSS

padding

 value

"var(--border-thin)"

A CSS

border-width

 value

invert

boolean

false

Whether to apply an inverted
theme. Only recommended for
greyscale designs.

Examples

Basic	box

 comes with default padding and border. The

Box

The
modular scale var(--s1)

 (

) and the

border-width

 uses the

padding

 value is set to the first point on the
 variable.

var(--border-thin)

<box-l>
		<!--	contents	of	the	box	-->
</box-l>

A	Box	within	a	Stack

In the context of a
element.

Stack

, the

Box

 will have

margin-top

 applied if it is preceded by a sibling

<stack-l>
		<p>...</p>
		<blockquote>...</blockquote>
		<box-l>
				<!--	Box	separated	by	vertical	margins	-->
		</box-l>
		<p>...</p>
		<div	role="figure">...</div>
</stack-l>

Box	with	a	header

An implementation of the nested
inverts the colors using

 example from
.
filter:	invert(100%)

Box

Use cases

. The

invert

 boolean attribute

<box-l	padding="0">
		<box-l	borderWidth="0"	invert>head</box-l>
		<box-l	borderWidth="0">body</box-l>
</box-l>

The	Center

The	problem

In the early days of HTML, there were a number of presentational elements; elements devised
purely to affect the appearance of their content. The
is
long since been considered obsolete. Curiously, it
Google's Chrome. Presumably this is because Google's search homepage still uses a
center-justify its famous search input.

 was one such element, but has
<center>
 still supported in some browsers, including

<center>

↗

 to

Tech' giants' whimsical usage of defunct elements aside, we mostly moved away from using
presentational markup in the 2000s. By making styling the responsibility of a separate
technology—CSS—we were able to manage style and structure separately. Consequently, a
change in art direction would no longer mean reconstituting our content.

We later discovered that styling HTML purely in terms of semantics and context was rather
ambitious, and led to some unwieldy selectors like

body	>	div	>	div	>	a	{
		/*
		Link	styles	specifically	for	links
		nested	two	<div>s	inside	the	body	element
		*/
}

For the sake of easier CSS maintenance and style modularity many of us adopted a compromise
position using classes. Because classes can be placed on any element, we are free to style, say,
a non-semantic
same token, but without compromising on accessibility.

 in exactly the same way, using the

 or a screen reader recognized

<div>

<nav>

<div	class="text-align:center"></div>

<nav	class="text-align:center"></nav>

Naming	conventions

You'll notice my very
naming for
structure is designed to help with recollection.

 is covered in the

utility
classes

on
the
nose

 naming convention in the preceding example. My choice of
 section. In short, the

property-name:value

Measure

<center>

All
especially content that includes paragraph text—you'll want to avoid it.

text-align:	center

 did, and all

 does, is center-justify text. And for most content—

It's terrible for readability

↗

.

would

 be useful is a component that can create a horizontally centered column. With

But what
such a component, we could create a centered 'stripe' of content within any container, capping
its width to preserve a

reasonable measure

.

The	solution

One of the easiest ways to solve for a centered column is to use
as its name suggests, instructs the browser to calculate the margin for you. It's perhaps one of
the most rudimentary examples of an
browser's logic to determine the layout rather than 'hard coding' a specific value.

 CSS technique: one that defers to the

 margins. The

algorithmic

auto

auto

 keyword,

My first centered columns would use the

margin

 shorthand, often on the

<body>

 element.

.center	{
		max-width:	60ch;
		margin:	0	auto;
}

The trouble with the shorthand property—though it saves a few bytes—is that you have to
declare certain values, even when they are not applicable. It's important to only set the CSS
values needed to achieve the specific layout you are attempting. You never know what inferred
or inherited values you might be undoing.

For example, I might want to place my
 on its children, and any
sets

margin-top

<center-l>

<center-l>

 custom element
 with

margin:	0	auto

 within a

Stack
 would undo that.

 context.

Stack

Instead, I could use the explicit
margin-right
margins contextually applied would be preserved, and the
primed for

/nesting among other layout components.

composition

margin-left

 and

 properties. Then, any vertical

<center-l>

 component would be

.center	{
		max-width:	60ch;
		margin-left:	auto;
		margin-right:	auto;
}

margin-inline logical property
↗
Even better, I could use a single
properties pertain to direction and dimension mappings and are—as such—compatible with a
wider range of languages. We are also using

. As described in

 in place of

max-inline-size

max-width

Boxes

, logical

.

.center	{
		max-inline-size:	60ch;
		margin-inline:	auto;
}

Measure

max-inline-size

The
achieving a reasonable measure is paramount. The
reasonable measure.

 should typically—as in the preceding code example—be set in

ch

, since

Axioms

 section details how to set a

Minimum	margin

In a context narrower than
element or viewport. Rather than letting this happen, we should ensure a
either side.

60ch

, the contents will currently be flush with either side of the parent

minimum

 space on

I need to go about this in such a way that preserves centering, and the
Since we can't enter
 into a calculation (like
padding.

calc(auto	+	1rem)

auto

60ch

 maximum width.

), we should probably defer to

But I have to be wary of the box model. If, as suggested in
adopt
box-sizing:	border-box
total. In other words, adding
covered in
Axioms
, and allow the padding to 'grow out' from the

, any padding added to my
 will make the
exceptions

 CSS is designed for

content-box

padding

<center-l>

Boxes

, I have set all elements to
 will contribute to the
 of my element narrower. However, as

60ch

content
. I just need to override

border-box

 with

60ch

 content threshold.

Here's a version that preserves the
“margins” on either side (

--s1

60ch max-width

, but ensures there are, at least,

 is the first point on the custom property-based

var(--s1)
modular scale

).

.center	{
		box-sizing:	content-box;
		max-inline-size:	60ch;
		margin-inline:	auto;
		padding-inline-start:	var(--s1);
		padding-inline-end:	var(--s1);
}

Intrinsic	centering

 margin solution is time-honoured and perfectly serviceable. But there is an opportunity

auto

The
using the Flexbox layout module to support
on their natural, content-based widths. Consider the following code.

intrinsic

 centering. That is, centering elements based

.center	{
		box-sizing:	content-box;
		max-inline-size:	60ch;
		margin-inline:	auto;
		display:	flex;
		flex-direction:	column;
		align-items:	center;
}

<center-l>

Inside a
column, hence
center any children

regardless

 of their width.

 component, I would expect the contents to be arranged vertically, as a
, which will

. This allows me to set

align-items:	center

flex-direction:	column

The upshot is any elements that are narrower than

60ch

 will be automatically centered within the

-wide area. These elements can include naturally small elements like buttons, or elements

60ch
with their own

max-width

 set under

60ch

.

The
illustrated
paragraphs
are
subject
to

align-items:	center

,
but
naturally
take
up
all
the
available
space
(they
are

block
elements

with
no
set
width).

⚠		Accessibility

Be aware that, whenever you move content away from the left-hand edge (in a left-to-right
writing direction), there's a potential accessibility issue. Where a user has zoomed the
interface, it's possible the centered content will have moved out of the viewport. They may
never realise it's there.

So long as your interface is flexible and responsive, and no fixed width is set on the container,
the centered content should be visible in most circumstances.

Use	cases

Whenever you wish something to be horizontally centered, the

Center

 is your friend. In the

following example, I am emulating the basic layout for the
(which you may be looking at now, unless you’re reading the EPUB). It comprises a
with a
the
'Launch demo' button.

Every
Layout

 to the right-hand side. Elements are vertically separated in both the sidebar and

 documentation site
Sidebar

 boolean applied centers the

. A nested

 with the

Stacks

Center

Center

Center

intrinsic

 using

,

(You may need to launch it in its own (desktop) window to see the centering in action.)

This interactive demo is only available on the

Every
Layout

 site
↗
.

The	Generator

Use this tool to generate basic

Center

 CSS and HTML.

The code generator tool is only available in
basic solution, with comments (omitting the

the accompanying documentation site
↗
intrinsic centering

 code):

. Here is the

CSS

.center	{
		/*	↓	Remove	padding	from	the	width	calculation	*/
		box-sizing:	content-box;
		/*	↓	The	maximum	width	is	the	maximum	measure	*/
		max-inline-size:	60ch;
		/*	↓	Only	affect	horizontal	margins	*/
		margin-inline:	auto;
		/*	↓	Apply	the	minimum	horizontal	space	*/
		padding-inline-start:	var(--s1);
		padding-inline-end:	var(--s1);
}

HTML

<div	class="center">
		<!--	centered	content	-->
</div>

The	Component

A custom element implementation of the Center is available for

download
↗
.

Props	API

The following props (attributes) will cause the
They can be altered by hand—in browser developer tools—or as the subjects of inherited

 component to re-render when altered.

Center

application state.

Type

string

boolean

boolean

boolean

Name

max

andText

gutters

intrinsic

Examples

Basic

Default

Description

"var(--measure)"

false

0

false

A CSS

max-width

 value

Center align the text too (
)

align:	center

text-

The minimum space on either
side of the content

Center child elements based on
their content width

Center
 being padded by default means providing padding to either side of the

You can create a single column web page just by nesting a
The
the

 prop is not necessary.

 inside a

Stack

gutters

Box

 inside a

.

Box
 using

Center

<box-l>
		<center-l>
				<stack-l>
						<!--	Any	flow	content	here	(headings,	paragraphs,	etc)	-->
				</stack-l>
		<center-l>
</box-l>

Documentation	layout

Use cases

The markup from the example in
added for screen reader support. Note that the
container. This
Sidebar's
logic inside it. The
available horizontal space. Read

 wraps when this

 is subject to the

Sidebar

Sidebar

<div>

. In the example, WAI-ARIA landmark roles have been
 has been wrapped in a generic

<div>

Center
 layout logic, freeing the

Center

 to apply its own

<div>

 starts to take up less that

66.666%

 of the

 for a full explanation.

<sidebar-l	contentMin="66.666%"	sideWidth="10rem">
		<stack-l	role="navigation">
				<!--	navigation	items	(API	refs)	-->
		</stack-l>
		<div>
				<center-l	role="main">
						<!--	main	content	for	the	page	-->
				</center-l>
		</div>
</sidebar-l>

Vertical	and	horizontal	centering

Using composition and the
element. The
width.

intrinsic

Cover

 vertically center an
 boolean is used here to center the paragraph regardless of its content's

 component, it's trivial to horizontally

and

<cover-l	centered="center-l">
		<center-l	intrinsic>
				<p>I	am	in	the	absolute	center.</p>
		</center-l>
</cover-l>

The	Cluster

The	problem

grids

 are an appropriate framework for laying out content, because you want that

Sometimes
content to align strictly to the horizontal and vertical lines that are those row and column
boundaries.

But not everything benefits from this prescribed rigidity — at least not in all circumstances. Text
itself cannot adhere to the strictures of a grid, because words come in different shapes and
lengths. Instead, the browser's text wrapping algorithm distributes the text to fill the available
space as best it can. Left-aligned text has a 'ragged' right edge, because each line will inevitably
be of a different length.

line-height

Thanks to leading (
you), words can be reasonably evenly spaced, despite their diversity of form. Where we am
elements
dealing with groups of
distribute in a similarly fluid way.

 of an indeterminate size/shape, we should often like them to

) and word spaces (the

 character, or a

U+0020

SPACE

 keypress to

One approach is to set these elements'
control over
margin
still sized according to the dimensions of their content.

 value to
 while retaining intrinsic sizing. That is,

inline-block

padding

display

 and

. This gives you some

inline-block

 elements are

inline-block

However, like words,
present in the source). The width of this space will be added to any
can be removed, but only by setting
children.

font-size:	0

margin
 on the parent, and resetting the value on the

 you apply. This space

 elements are still separated by space characters (where

.parent	{
		font-size:	0;
}

.parent	>	*	{
		font-size:	1rem;
}

This has the disadvantage that we can't use
to  . Instead, we need to set the
 relative to the
having to be reset in this fashion is somewhat restrictive.

font-size

em

0

 on my child elements because it would be equal
 element with the

 unit. Font size

:root

rem

Even with the space eliminated, there are still wrapping-related margin issues. If margin is
applied to successive elements, the appearance is acceptable where

 wrapping occurs. But

no

where wrapping does occur, there are unexpected indents against the aligned side, and vertical
spacing is missing entirely.

A partial fix is possible by placing right and bottom margins on each element.

However, this only solves the left-aligned case — plus doubled-up space occurs where excess
margin interacts with the padding of a parent element:

The	solution

To create an efficient and manageable design system, we need to devise robust,
solutions to our layout problems.

general

First, we make the parent a Flexbox context. This allows us to configure the elements into
clusters, without having to deal with undesirable word spaces. It also has several advantages
over using floats: we do not need to provide a

 for one, and vertical alignment (using

clear fix
↗

align-items

) is possible.

.cluster	{
		display:	flex;
		flex-wrap:	wrap;
}

Adding	and	obscuring	margin

The only way we can currently add margins that respect wrapping behaviour, irrespective of the
alignment chosen, is to add them
elements from any edge with which they come into contact.

; to all sides. Unfortunately, this separates the

symmetrically

Note the value of the space between a child element and a parent element's edge is always
that of the space between two child elements (since their margins combine together). The
solution is to use a negative margin on the parent to

 the children to its own edges:

pull

half

We can make authoring space in the

Cluster

 component easier by using custom properties. The

 variable defines the desired spacing between elements, and

--space
accordingly. Note that a further wrapper element is included to
negative margin. We still want the component to respect white space applied by a parent
component.

 adapts this value

insulate

calc()

 adjacent content from the

Stack

.cluster	{
		--space:	1rem;
}

.cluster	>	*	{
		display:	flex;
		flex-wrap:	wrap;
		/*	↓	multiply	by	-1	to	negate	the	halved	value	*/
		margin:	calc(var(--space)	/	2	*	-1);
}

.cluster	>	*	>	*	{
		/*	↓	half	the	value,	because	of	the	'doubling	up'	*/
		margin:	calc(var(--space)	/	2);
}

The

gap

	property

I think you’ll agree the above technique is a bit unwieldy. It can also cause the horizontal
scrollbar to appear, under some circumstances. Fortunately, as of mid-2021,
now support the
elements, doing away with the need for both negative margins and the additional wrapper
element. Even the

 property with Flexbox
↗

 can be retired, since the

 property injects spacing

 value is just that!

between

. The

calc()

gap

gap

gap

all major browsers
 the child

.cluster	{
		display:	flex;
		flex-wrap:	wrap;
		gap:	var(--space,	1rem);
}

Fallback	values

See how we’re defining and declaring the

gap

 value all in one line. The second argument to the

var()

 function is the fallback value

for when the variable is otherwise undefined
↗
.

Graceful	degradation

Despite the reassuring support picture for
where it isn’t supported. Problematically,
 in a
) but not for Flexbox, so using
Grid

gap

gap

gap

, we should be mindful of the layout in browsers
 may be supported for the Grid layout module (see

@supports

 block can give a false positive.

In browsers where
or gap
margin

gap
 being applied.

 is only supported for the Grid module, the following would lead to no

/*	This	won’t	work	*/
.cluster	>	*	{
		display:	flex;
		flex-wrap:	wrap;
		margin:	1rem;
}

@supports	(gap:	1rem)	{
		.cluster	>	*	{
				margin:	0;
		}

		.cluster	{
				gap:	var(--space,	1rem);
		}
}

As of today, we recommend using
become
preference instead.

flush

 in older browsers. We include the negative margin technique above if that’s your

gap

 without feature detection, accepting that layouts will

Justification

Groups or
 of elements can take any
honored regardless of wrapping. Aligning the

clusters

justify-content

 value, and the space/gap will be

Cluster

 to the right would be a case for

justify-

content:	flex-end

.

In the demo to follow, a
with a

Cluster
 value equal to that of the

padding

Cluster’s

 space.

 contains a list of linked keywords. This is placed inside a box

This interactive demo is only available on the

Every
Layout

 site
↗
.

Use	cases

 components suit any groups of elements that differ in length and are liable to wrap.

Cluster
Buttons that appear together at the end of forms are ideal candidates, as well as lists of tags,
keywords, or other meta information. Use the
elements to the left or right, or in the center.

 to align any groups of horizontally laid out

Cluster

justify-content:	space-between

By applying
page header’s logo and navigation. This will wrap naturally, and without the need for an
breakpoint:

align-items:	center

 you can even set out your

 and

@media

The
navigation
list
will
wrap
below
the
logo
at
the
point
there
is
no
room
for
its
unwrapped
content
(its
maximum
width).
This

means
we
avoid
the
scenario
where
navigation
links
appear
both
beside

and

below
the
logo.

Below is a demo of the aforementioned header layout, using a nested
outer
Cluster
navigation links uses

justify-content:	space-between

 and
 to align its items to the left after wrapping.

justify-content:	flex-start

align-items:	center

 structure. The

Cluster

Cluster

 uses

. The

 for the

This interactive demo is only available on the

Every
Layout

 site
↗
.

The	generator

Use this tool to generate basic

Cluster

 CSS and HTML.

The code generator tool is only available in
basic solution, with comments:

the accompanying documentation site
↗

. Here is the

CSS

.cluster	{
		/*	↓	Set	the	Flexbox	context	*/
		display:	flex;
		/*	↓	Enable	wrapping	*/
		flex-wrap:	wrap;
		/*	↓	Set	the	space/gap	*/
		gap:	var(--space,	1rem);
		/*	↓	Choose	your	justification	(flex-start	is	default)	*/
		justify-content:	center;
		/*	↓	Choose	your	alignment	(flex-start	is	default)	*/
		align-items:	center;
}

HTML

<ul	class="cluster">
		<li><!--	child	--></li>
		<li><!--	child	--></li>
		<li><!--	etc	--></li>
</ul>

The	component

A custom element implementation of the Cluster is available for

download
↗
.

Props	API

The following props (attributes) will cause the
They can be altered by hand—in browser developer tools—or as the subjects of inherited
application state.

 component to re-render when altered.

Cluster

Description

A CSS

justify-content

 value

A CSS

align-items

 value

gap

 value. The minimum

A CSS
space between the clustered
child elements.

Name

justify

align

space

Type

string

string

string

Default

"flex-start"

"flex-start"

"var(--s1)"

Examples

Basic

Using the defaults.

<cluster-l>
		<!--	child	element	here	-->
		<!--	another	child	element	-->
		<!--	etc	-->
		<!--	etc	-->
		<!--	etc	-->
		<!--	etc	-->
</cluster-l>

List

Clusters

Since
 typically represent groups of similar elements, they benefit from being marked up
as a list. List elements present information non-visually, to screen reader software. It’s important
screen reader users are aware there

 a list present, and how many items it contains.

is

Since our custom element
parent) we can provide the list semantics using ARIA instead:

 is not a

<cluster-l>

 (and

 elements cannot exist without a
 and

<ul>
:
role="listitem"

role="list"

<ul>

<li>

<cluster-l	role="list">
		<div	role="listitem"><!--	content	of	first	list	item	--></div>
		<div	role="listitem"><!--	content	of	second	list	item	--></div>
		<div	role="listitem"><!--	etc	--></div>
		<div	role="listitem"><!--	etc	--></div>
</cluster-l>

The	Sidebar

The	problem

When the dimensions and settings of the medium for your visual design are indeterminate, even
something simple like
horizontal space? And, even if there is, will the layout make the most of the

 is a quandary. Will there be enough
 space?

putting
things
next
to
other
things

vertical

Where there’s not enough space for two adjacent items, we tend to employ a breakpoint (a
width-based

 query) to reconfigure the layout, and place the two items one atop the other.

@media

content

It’s important we use
intervene anywhere the content needs reconfiguration, rather than adhering to arbitrary widths
like
. The massive proliferation of devices means there’s no real set of standard
dimensions to design for.

 queries. That is, we should

 rather than

 based

device

 and

1024px

@media

720px

 width, and have no bearing on the actual available space. A component might appear

But even this strategy has a fundamental shortcoming:
viewport
 wide container, or it might appear within a more generous
within a
the width of the viewport is the same in either case, so there’s nothing to “respond” to.

 queries for width pertain to the

 wide container. But

@media

300px

500px

Design systems tend to catalogue components that can appear between different contexts and
spaces, so this is a real problem. Only with a capability like the mooted
might we teach our component layouts to be fully

container queries
↗

context
aware

.

In some respects, the CSS Flexbox module, with its provision of
its own layout, per context, rather well. Consider the following code:

flex-basis

, can already govern

.parent	{
		display:	flex;
		flex-wrap:	wrap;
}

.parent	>	*	{
		flex-grow:	1;
		flex-shrink:	1;
		flex-basis:	30ch;
}

flex-basis

 value essentially determines an

The
 target width for the subject child elements.
With growing, shrinking, and wrapping enabled, the available space is used up such that each
close
element is as
may appear per row. Between
the whole of the final row (if the total number is odd).

 wide container, more than three children
 only two items can appear, with one item taking up

 wide as possible. In a
 and

ideal

>	90ch

 to

60ch

30ch

90ch

An
item
with
an
odd
index,
which
is
also
the
last
item,
can
be
expressed
by
concatenating
two
pseudo
selectors:
:nth-

child(odd):last-child

ideal

 element dimensions, and tolerating reasonable variance, you can

By designing to
essentially do away with
and without the need for manual intervention. Many of the layouts we’re covering finesse this
basic mechanism to give you more precise control over placement and wrapping.

 breakpoints. Your component handles its own layout, intrinsically,

@media

For instance, we might want to create a classic sidebar layout, wherein one of two adjacent
principle
elements has a fixed width, and the other—the
the available space. This should be responsive, without
able to set a

@media
 based breakpoint for wrapping the elements into a vertical configuration.

 element, if you will—takes up the rest of

 breakpoints, and we should be

container

The	solution

Sidebar

 layout is named for the element that forms the diminutive

The
two adjacent elements. It is a
configurations—horizontal and vertical—illustrated below. Which configuration is adopted is not
known at the time of conception, and is dependent entirely on the space it is afforded when
placed within a parent container.

 layout, existing simultaneously in one of the two

: the narrower of

quantum

sidebar

Where there is enough space, the two elements appear side-by-side. Critically, the sidebar’s
width is
available space. But when the two elements wrap,

 while the two elements are adjacent, and the non-sidebar takes up the rest of the
each

 of the shared container.

 takes up

fixed

100%

Equal	height

Note the two adjacent elements are the same height, regardless of the content they contain.
This is thanks to a default
was very difficult to achieve before the advent of Flexbox). However, you can “switch off” this
behavior with

. In most cases, this is desirable (and

align-items:	flex-start

 value of

align-items

stretch

.

How to force wrapping at a certain point, we will come to shortly. First, we need to set up the
horizontal layout.

.with-sidebar	{
		display:	flex;
		flex-wrap:	wrap;
}

.sidebar	{
		flex-basis:	20rem;
		flex-grow:	1;
}

.not-sidebar	{
		flex-basis:	0;
		flex-grow:	999;
}

The key thing to understand here is the role of
 value
element’s
of the
 element is not counted as available space and is subtracted from the total, hence
the sidebar-like layout. The non-sidebar essentially squashes the sidebar down to its ideal width.

), it takes up all the available space. The

 value is so high (

available
space

. Because the

.not-sidebar

flex-basis

flex-grow

.sidebar

999

.sidebar

 element is still technically allowed to grow, and is able to do so where

The
wraps beneath it. To control where that wrapping happens, we can use
equivalent to

 writing mode.

 in the default

horizontal-tb

min-width

.not-sidebar

min-inline-size

, which is

.not-sidebar	{
		flex-basis:	0;
		flex-grow:	999;
		min-inline-size:	50%;
}

.not-sidebar

Where
onto a new line/row and grows to take up all of its space. The value can be anything, but
apt since a sidebar ceases to be a sidebar when it is no longer the narrower of the two elements.

 is destined to be less than or equal to

 of the container’s width, it is forced

50%

50%

 is

The	gutter

So far, we’re treating the two elements as if they’re touching. Instead, we might want to place a

gutter/space between them. Since we want that space to appear between the elements
regardless of the configuration and we
edges, we’ll use the

 property as we did for the

 want there to be extraneous margins on the outer

Cluster

 layout
.

don’t

gap

For a gutter of

1rem

, the CSS now looks like the following.

.with-sidebar	{
		display:	flex;
		flex-wrap:	wrap;
		gap:	1rem;
}

.sidebar	{
		/*	↓	The	width	when	the	sidebar	_is_	a	sidebar	*/
		flex-basis:	20rem;
		flex-grow:	1;
}

.not-sidebar	{
		/*	↓	Grow	from	nothing	*/
		flex-basis:	0;
		flex-grow:	999;
		/*	↓	Wrap	when	the	elements	are	of	equal	width	*/
		min-inline-size:	50%;
}

This interactive demo is only available on the

Every
Layout

 site
↗
.

Intrinsic	sidebar	width

So far, we have been prescribing the width of our sidebar element (
example). Instead, we might want to let the sidebar’s
not provide a
flex-basis
wrapping behavior remains the same.

, in the last
 determine its width. Where we do
 value at all, the sidebar’s width is equal to the width of its contents. The

flex-basis:	20rem

content

If we set the width of an image inside of our sidebar to
in the horizontal configuration. It will grow to

100%

 in the vertical configuration.

15rem

, that will be the width of the sidebar

Intrinsic	web	design

Intrinsic
Web
Design
↗

The term
towards tools and mechanisms in CSS that are more befitting of the medium. The kind of
algorithmic
methods.

, self-governing layouts set out in this series might be considered intrinsic design

 was coined by Jen Simmons, and refers to a recent move

intrinsic

The term
 connotes introspective processes; calculations made by the layout pattern
about itself. My use of 'intrinsic' in this section specifically refers to the inevitable width of an
element as determined by its contents. A button's width, unless explicitly set, is the width of
what's inside it.

The CSS Box Sizing Module was formerly called the Intrinsic & Extrinsic Sizing Module,
because it set out how elements can be sized both intrinsically and extrinsically. Generally, we
should err on the side of intrinsic sizing. As covered in
browser to size elements according to their content, and only provide
prescriptions

, we're better allowing the
suggestions

, for layout. We are

, rather than

outsiders
.

Axioms

Use	cases

Sidebar

 is applicable to all sorts of content. The ubiquitous “media object” (the placing of an

The
item of media next to a description) is a mainstay, but it can also be used to align buttons with
form inputs (where the button forms the sidebar and has an

, content-based width).

intrinsic

The following example uses the

component

 version, defined as a custom element.

<form>
		<sidebar-l	side="right"	space="0"	contentMin="66.666%">
				<input	type="text">
				<button>Search</button>
		</sidebar-l>
</form>

This interactive demo is only available on the

Every
Layout

 site
↗
.

The	generator

Use this tool to generate basic

Sidebar

 CSS and HTML.

The code generator tool is only available in
basic solution, with comments. It is assumed the

the accompanying documentation site
↗

non

-sidebar is the

:last-child

. Here is the
 in this example.

CSS

.with-sidebar	{
		display:	flex;
		flex-wrap:	wrap;
		/*	↓	The	default	value	is	the	first	point	on	the	modular	scale	*/
		gap:	var(--gutter,	var(--s1));
}

.with-sidebar	>	:first-child	{
		/*	↓	The	width	when	the	sidebar	_is_	a	sidebar	*/
		flex-basis:	20rem;
		flex-grow:	1;
}

.with-sidebar	>	:last-child	{
		/*	↓	Grow	from	nothing	*/
		flex-basis:	0;
		flex-grow:	999;
		/*	↓	Wrap	when	the	elements	are	of	equal	width	*/
		min-inline-size:	50%;
}

HTML

(You don’t

have

 to use

<div>

s; use semantic elements where appropriate.)

<div	class="with-sidebar">
		<div><!--	sidebar	--></div>
		<div><!--	non-sidebar	--></div>
</div>

The	component

A custom element implementation of the Sidebar is available for

download
↗
.

Props	API

The following props (attributes) will cause the
They can be altered by hand—in browser developer tools—or as the subjects of inherited
application state.

 component to re-render when altered.

Sidebar

Name

side

Type

string

Default

"left"

Description

Which element to treat as the
sidebar (all values but "left" are
considered "right")

sideWidth

string

contentMin

string

"50%"

space

string

"var(--s1)"

noStretch

boolean

false

Examples

Media	object

when

Represents the width of the
sidebar
(
null
content width

 adjacent. If not set
) it defaults to the sidebar's

percentage

A CSS
 value. The
minimum width of the content
element in the horizontal
configuration

A CSS margin value representing
the space between the two
elements

Make the adjacent elements
adopt their natural height

Uses the default
based

50%
modular scale

 “breakpoint” and an increased
. The sidebar/image is

15rem

space

 value, taken from the custom property-

 wide in the horizontal configuration.

Because the image is a flex child,
was placed inside a

<div>

 (making the

noStretch

<div>

 must be supplied, to stop it distorting. If the image
 the flex child) this would not be necessary.

<sidebar-l	space="var(--s2)"	sideWidth="15rem"	noStretch>
		<img	src="path/to/image"	alt="Description	of	image"	/>
		<p><!--	the	text	accompanying	the	image	--></p>
</sidebar-l>

Switched	media	object

The same as the last example, except the text
(
side="right"

accompanying
), allowing the image to grow when the layout is in the horizontal configuration. The

 the image is the sidebar

 sidebar has a width (

measure
↗ 30ch

) of

<p>
configuration.

 (approximately 30 characters) in the horizontal

The image is contained in
should grow to use up the available space, so the basic CSS for responsive images should be in
your global styles (

 is not necessary in this case. The image

img	{	max-width:	100%	}

, meaning

noStretch

<div>

).

<sidebar-l	space="var(--s2)"	side="right"	sideWidth="30ch">
		<div>
				<image	src="path/to/image"	alt="Description	of	image">
		</div>
		<p><!--	the	text	accompanying	the	image	--></p>
</sidebar-l>

The	Switcher

, it’s better to provide

As we set out in
Boxes
visual design is laid out. An overuse of
fix
arrange our layout boxes, we move from creating multiple layouts to single
existing simultaneously in different states.

@media

suggestions
 breakpoints can easily come about when we try to

 rather than diktats about the way the

 designs to different contexts and devices. By only suggesting to the browser how it should

quantum

 layouts

The
flex-basis
declaration of

 property is an especially useful tool when adopting such an approach. A

width:	20rem

 means just that: make it

20rem

 wide — regardless of circumstance. But

 is more nuanced. It tells the browser to consider

flex-basis:	20rem
width. It is then free to calculate just how closely the
content and available space. You empower the browser to make the right decision for the
content, and the user, reading that content, given their circumstances.

 as an ideal or “target”
 target can be resembled given the

20rem

20rem

Consider the following code.

.grid	{
		display:	flex;
		flex-wrap:	wrap;
}

.grid	>	*	{
		width:	33.333%;
}

@media	(max-width:	60rem)	{
		.grid	>	*	{
				width:	50%;
		}
}

@media	(max-width:	30rem)	{
		.grid	>	*	{
				width:	100%;
		}
}

The mistake here (aside from not using the logical property
adopt an
our boxes to it. It’s verbose, unreliable, and doesn’t make the most of Flexbox’s capabilities.

 approach to the layout: we are thinking about the viewport first, then adapting

 in place of

inline-size

extrinsic

) is to

width

flex-basis

With
breakpoint intervention. Consider this alternative code:

, it's easy to make a responsive Grid-like layout which is in no need of

@media

.grid	{
		display:	flex;
		flex-wrap:	wrap;
}

.grid	>	*	{
		flex:	1	1	20rem;
}

Now I'm thinking
shorthand property
↗

wide"
make
it
about

I’m telling the browser to
automated my layout.

20rem

intrinsically

 — in terms of the subject elements’ own dimensions. That

flex

 translates to

"let
each
element
grow
and
shrink
to
fill
the
space,
but
try
to

. Instead of manually pairing the column count to the viewport width,
generate
 the columns based on my desired column width. I’ve

As

 has pointed out,

Zoe Mickley Gillenwater
↗

, achieves something similar to an

flex-grow
 in that “breaks” occur,
flex-shrink
implicitly, according to the available space rather than the viewport width. My Flexbox “grid” will
automatically adopt a different layout depending on the size of the container in which it is placed.
Hence:

element/container query
↗

quantum
layout
.

, in combination with

flex-basis

 and

Issues	with	two-dimensional	symmetry

While this is a serviceable layout mechanism, it only produces two layouts wherein each element
is the same width:

The single-column layout (given the narrowest of containers)
The regular multi-column layout (where each row has an equal number of columns)

In other cases, the number of elements and the available space conspire to make layouts like
these:

necessarily

This is not
 a problem that needs to be solved, depending on the brief. So long as the
content configures itself to remain in the space, unobscured, the most important battle has been
won. However, for smaller numbers of subject elements, there may be cases where you wish to
directly
switch
intermediary states.

 from a horizontal (one row) to a vertical (one column) layout and bypass the

Any element that has wrapped and grown to adopt a different width could be perceived by the
user as being “picked out”; made to deliberately look different, or more important. We should
want to avoid this confusion.

The	solution

Switcher

The
 element (based on the bizarrely named
Flexbox context between a horizontal and a vertical layout at a given,
breakpoint. That is, if the breakpoint is
when the parent element is less than

Flexbox Holy Albatross
↗
container

 wide.

30rem

30rem

, the layout will switch to a vertical configuration

) switches a
-based

In order to achieve this switch, first a basic horizontal layout is instated, with wrapping and

flex-

grow

 enabled:

.switcher	>	*	{
		display:	flex;
		flex-wrap:	wrap;
}

.switcher	>	*	>	*	{
		flex-grow:	1;
}

flex-basis

The
calculation with the designated

30rem

 breakpoint.

 value enters the (current) width of the container, expressed as

100%

, into a

30rem	-	100%

Depending on the parsed value of
if the container is narrower than
very
large

 to produce either a

999

30rem
 positive number or a

100%

 value: positive
, this will return either a
, or negative if it is wider. This number is then multiplied by

negative

positive

 or

very
large

 negative number:

(30rem	-	100%)	*	999

Here is the

flex-basis

 declaration in situ:

.switcher	>	*	{
		display:	flex;
		flex-wrap:	wrap;
}

.switcher	>	*	>	*	{
		flex-grow:	1;
		flex-basis:	calc((30rem	-	100%)	*	999);
}

flex-basis

A negative
means just the
 value is corrected to   and—because
negative
grows to take up an equal proportion of horizontal space.

flex-basis

flex-basis

0

 value is invalid, and dropped. Thanks to CSS’s resilient error handling this
 line is ignored, and the rest of the CSS is still applied. The erroneous

flex-grow

 is present—each element

⚠		Content	width

The previous statement,
"each
element
grows
to
take
up
an
equal
proportion
of
the
horizontal
content
space"
 of any one element does not exceed that alloted proportion.
 is true where the
To keep things in order, nested elements can be given a

max-inline-size

 of

100%

.

As
ever,
setting
fixed
widths
(or
even

min-width

s)
can
be
problematic.
Instead,
width
should
be

suggested

or

inferred

from

context.

If, on the other hand, the calculated
maxes
out
configurations are successfully bypassed.

 to take up a whole row. This results in the vertical configuration. Intermediary

flex-basis

 value is a large positive number, each element

Gutters

To support margins ('gutters'; 'gaps') between the subject elements, we could adapt the
negative margin technique covered in the
Cluster
flex-basis
calculation would need to be adapted to compensate for the increased width produced by
stretching
 the parent element. That is, by applying negative margins on all sides, the parent
becomes wider than

 values no longer match.

 container and their

 documentation

. However, the

100%

its

.switcher	{
		--threshold:	30rem;
		--space:	1rem;
}

.switcher	>	*	{
		display:	flex;
		flex-wrap:	wrap;
		/*	↓	Multiply	by	-1	to	make	negative	*/
		margin:	calc(var(--space)	/	2	*	-1);
}

.switcher	>	*	>	*	{
		flex-grow:	1;
		flex-basis:	calc((var(--threshold)	-	(100%	-	var(--space)))	*	999);
		/*	↓	Half	the	value	to	each	element,	combining	to	make	the	whole	*/
		margin:	calc(var(--space)	/	2);
}

 is now supported in all major browsers, we don’t have to worry about such

gap

Instead, since
calculations any more. The
And it allows us to cut both the HTML and CSS code down quite a bit.

gap

 property represents the browser making such calculations for us.

.switcher	{
		display:	flex;
		flex-wrap:	wrap;
		gap:	1rem;
		--threshold:	30rem;
}

.switcher	>	*	{
		flex-grow:	1;
		flex-basis:	calc((var(--threshold)	-	100%)	*	999);
}

This interactive demo is only available on the

Every
Layout

 site
↗
.

Managing	proportions

There is no reason why one or more of the elements, when in a horizontal configuration,
cannot be alloted more or less of the available space. By giving the second element (

:nth-

)

child(2) flex-grow:	2
compensate).

 will become twice as wide as its siblings (and the siblings will shrink to

.switcher	>	:nth-child(2)	{
		flex-grow:	2;
}

Quantity	threshold

In the horizontal configuration, the amount of space alloted each element is determined by two
things:

The total space available (the width of the container)

The number of sibling elements

Switcher switches

So far, my
elements as we like, and they will lay out together horizontally above the breakpoint (or
threshold
start to get squashed up.

 according to the available space. But we can add as many

). The more elements we add, the less space each gets alloted, and things can easily

This is something that could be addressed in documentation, or by providing warning or error
messages in the developer's console. But that isn't very efficient or robust. Better to
 the
layout to handle this problem itself. The aim for each of the layouts in this project is to make
them as self-governing as possible.

teach

It is quite possible to style each of a group of sibling elements based on how many siblings there
are in total. The technique is something called a

. Consider the following code.

quantity query
↗

.switcher	>	:nth-last-child(n+5),
.switcher	>	:nth-last-child(n+5)	~	*	{
		flex-basis:	100%;
}

flex-basis

Here, we are applying a
. The
elements
in
total
from the
of the elements (it matches anything after

nth-last-child(n+5)

end

 of

100%

 of the set. Then, the general sibling combinator ( ) applies the same rule to the rest

:nth-last-child(n+5)

~
). If there are fewer that 5 items, no

 to each element, only where there are

five
or
more

 selector targets any elements that are more than 4

:nth-last-child(n+5)

 elements and the style is not applied.

Now the layout has two kinds of threshold that it can handle, and is twice as robust as a result.

Use	cases

There are any number of situations in which you might want to switch directly between a
horizontal and vertical layout. But it is especially useful where each element should be
considered equal, or part of a continuum. Card components advertising products should share
the same width no matter the orientation, otherwise one or more cards could be perceived as
highlighted or featured in some way.

A set of numbered steps is also easier on cognition if those steps are laid out along one
horizontal or vertical line.

The	Generator

The code generator tool is only available in
basic solution, with comments:

the accompanying documentation site
↗

. Here is the

CSS

.switcher	{
		display:	flex;
		flex-wrap:	wrap;
		/*	↓	The	default	value	is	the	first	point	on	the	modular	scale	*/
		gap:	var(--gutter,	var(--s1));
		/*	↓	The	width	at	which	the	layout	“breaks”	*/
		--threshold:	30rem;
}

.switcher	>	*	{
		/*	↓	Allow	children	to	grow	*/
		flex-grow:	1;
		/*	↓	Switch	the	layout	at	the	--threshold	*/
		flex-basis:	calc((var(--threshold)	-	100%)	*	999);
}

.switcher	>	:nth-last-child(n+5),
.switcher	>	:nth-last-child(n+5)	~	*	{
		/*	↓	Switch	to	a	vertical	configuration	if
		there	are	more	than	4	child	elements	*/
		flex-basis:	100%;
}

HTML

<div	class="switcher">
		<div><!--	child	element	--></div>
		<div><!--	another	child	element	--></div>
		<div><!--	etc	--></div>
</div>

The	Component

A custom element implementation of the Switcher is available for

download
↗
.

Props	API

The following props (attributes) will cause the
They can be altered by hand—in browser developer tools—or as the subjects of inherited
application state.

 component to re-render when altered.

Switcher

Name

threshold

space

limit

Type

string

string

Default

Description

"var(--measure)"

width

A CSS
the 'container breakpoint')

 value (representing

"var(--s1)"

A CSS

margin

 value

integer

4

A number representing the
maximum number of items
permitted for a horizontal layout

The	Cover

The	problem

For years, there was consternation about how hard it was to horizontally and vertically center
something with CSS. It was used by detractors of CSS as a kind of exemplary “proof” of its
shortcomings.

The truth is, there are numerous ways to center content with CSS. However, there are only so
many ways you can do it without fear of overflows, overlaps, or other such breakages. For
example, we could use
a parent:

 to vertically center an element within

 positioning and a

transform

relative

.parent	{
		/*	↓	Give	the	parent	the	height	of	the	viewport	*/
		block-size:	100vh;
}

.parent	>	.child	{
		position:	relative;
		/*	↓	Push	the	element	down	50%	of	the	parent	*/
		inset-block-start:	50%;
		/*	↓	Then	adjust	it	by	50%	of	its	own	height	*/
		transform:	translateY(-50%);
}

What’s neat about this is the
element itself—no matter what that height is. What’s less than neat is the top and bottom
overflow produced when the child element's content makes it taller than the parent. We have
not, so far, designed the layout to tolerate dynamic content.

 part, which compensates for the height of the

translateY(-50%)

Perhaps the most robust method is to combine Flexbox’s
 (vertical).
and

align-items:	center

justify-content:	center

 (horizontal)

.centered	{
		display:	flex;
		justify-content:	center;
		align-items:	center;
}

Proper	handling	of	height

Just applying the Flexbox CSS will not, on its own, have a visible effect on vertical centering
 element’s height is determined by the height of its content
because, by default, the
(implicitly,
, and is
covered in more detail in the

). This is something sometimes referred to as

 documentation.

intrinsic
sizing

block-size:	auto

Sidebar

.centered

 layout

Setting a fixed height—as in the unreliable
 example from before—would be foolhardy:
transform
we don’t know ahead of time how much content there will be, or how much vertical space it will
take up. In other words, there’s nothing stopping overflow from happening.

Instead, we can set a
element will expand vertically to accommodate the content, wherever the natural (

min-block-size min-height

horizontal-tb

 in the

 (

 writing mode). This way, the

auto

) height

happens to be more than the
padding ensures the centered content does not meet the edges.

min-block-size

. Where this happens, the provision of some vertical

Box	sizing

To ensure the parent element retains a height of

100vh

, despite the additional padding, a

box-

sizing:	border-box
height.

 value must be applied. Where it is not, the padding is

added

 to the total

box-sizing:	border-box

The
declaration block. The use of the   (universal) selector means all elements are affected.

 is so desirable, it is usually applied to all elements in a global

*

*	{
		box-sizing:	border-box;
		/*	other	global	styles	*/
}

This is perfectly serviceable where only one centered element is in contention. But we have a
habit of wanting to include other elements, above and below the centered one. Perhaps it's a
close button in the top right, or a “read more” indicator in the bottom center. In any case, I need
to handle these cases in a modular fashion, and without producing breakages.

The	solution

What I need is a layout component that can handle vertically centered content (under a

min-

 threshold) and can accommodate top/header and bottom/footer elements. To make

 I should be able to add and remove these elements in the
 adapt the CSS. It should be modular, and therefore not a coding

block-size
the component truly
HTML without having to
imposition on content editors.

composable
also

Cover

 component is a Flexbox context with

The
child elements are laid out vertically rather than horizontally. In other words, the 'flow direction' of
the Flexbox formatting context is returned to that of a standard block element.

. This declaration means

flex-direction:	column

.cover	{
		display:	flex;
		flex-direction:	column;
}

Cover

The
it can have one top/header element and/or one bottom/footer element.

 has one

principal

 element that should always gravitate towards the center. In addition,

How do we manage all these cases without having to adapt the CSS? First, we give the centered
element (
declaration using

 in the example, but it can be any element)

 margins. This can be done in one

margin-block

auto

h1

:

.cover	{
		display:	flex;
		flex-direction:	column;
}

.cover	>	h1	{
		margin-block:	auto;
}

push

These
available space. Critically, it will
sibling element.

 the element away from anything above and below it, moving it into the center of the
 the top/bottom edge of a
 the inside edge of a parent

push
off

or

Note
that,
in
the
right-hand
configuration,
the
centered
element
is
in
the
vertical
center
of
the

available

space.

All that remains is to ensure there is space between the (up to) three child elements where the

min-block-size

 threshold has been breached.

Currently, the

auto

 margins simply collapse down to nothing. Since we can’t enter

 into a
 is invalid), the best we can do is to add

auto

calc()

margin

 function to adapt the margin (
calc(auto	+	1rem)
 to the header and footer elements contextually.

.cover	>	*	{
		margin-block:	1rem;
}

.cover	>	h1	{
		margin-block:	auto;
}

.cover	>	:first-child:not(h1)	{
		margin-block-start:	0;
}

.cover	>	:last-child:not(h1)	{
		margin-block-end:	0;
}

the cascade, specificity
↗

Note, the use of
apply top and bottom margins to all the children, using a universal child selector. We then
override this for the to-be-centered (

 and negation to target the correct elements. First, we

) element to achieve the

auto

h1

 function to remove extraneous margin from the top and bottom elements

 the centered element. If there is a centered element and a footer element, but no header

:not()
not
element, the centered element will be the

:first-child

 and must retain

.
margin-block-start:	auto

 margins. Finally, we use the
only

 if they are

⚠		Shorthands

margin-block:	1rem

Notice how we use
component
(horizontal in the default writing mode) margins  , we might be unduly undoing styles applied
or inherited by an ancestor component.

 only cares about the vertical margins to achieve its layout. By making the inline

. The reason is that

margin:	1rem	0

 and not

this

0

Only set what you need to set.

This interactive demo is only available on the

Every
Layout

 site
↗
.

Now it is safe to add spacing around the inside of the
there are one, two or three elements present, spacing now remains
component modular without styling intervention.

Cover

 container using

padding

. Whether

symmetrical

, and our

.cover	{
		padding:	1rem;
		min-block-size:	100vh;
}

 is set to

min-block-size

The
(hence the name). However, there's no reason why the
value.
custom element implementation

sensible
default
 to come.

, so that the element

 is considered a

100vh

100vh

covers

 100% of the viewport's height

min-block-size

 cannot be set to another

, and is the default value for the

minHeight

 prop in the

Horizontal	centering

So far I've not tackled horizontal centering, and that's quite deliberate. Layout components
should try to solve just one problem—and the modular centering problem is a peculiar one. The
. You
Center
might wrap the
composition

 handles horizontal centering and can be used in composition with the
Center

 one or more of its children. It's all about

 or make a

Center

 layout

Cover

Cover

 in a

.

Use	cases

Cover

A typical use for the
web page. In the following demo, a nested
navigation menu. In this case, a utility class (
the

 and footer elements.

<h1>

 would be to create the “above the fold” introductory content for a

Cluster

 element

 is used to lay out the logo and

.text-align\:center

) is used to horizontally center

This interactive demo is only available on the

Every
Layout

 site
↗
.

It might be that you treat each section of the page as a
API to animate aspects of the cover as it comes into view. A simple implementation is provided
below (where the

 attribute is added as the element comes into view).

, and use the Intersection Observer

data-visible

Cover

if	('IntersectionObserver'	in	window)	{
		const	targets	=	Array.from(document.querySelectorAll('cover-l'));
		targets.forEach(t	=>	t.setAttribute('data-observe',	''));
		const	callback	=	(entries,	observer)	=>	{
				entries.forEach(entry	=>	{
						entry.target.setAttribute('data-visible',	entry.isIntersecting);
				});
		};

		const	observer	=	new	IntersectionObserver(callback);
		targets.forEach(t	=>	observer.observe(t));
}

The	generator

Use this tool to generate basic

Cover

 CSS and HTML.

The code generator tool is only available in
basic solution, with comments. It assumes the centered element is an
could be any element.

the accompanying documentation site
↗

. Here is the

<h1>

, in this case, but it

CSS

.cover	{
		--space:	var(--s1);
		/*	↓	Establish	a	columnal	flex	context	*/
		display:	flex;
		flex-direction:	column;
		/*	↓	Set	a	minimum	height	to	match	the	viewport	height
		(any	minimum	would	be	fine)	*/
		min-block-size:	100vh;
		/*	Set	a	padding	value	*/
		padding:	var(--space);
}

.cover	>	*	{
		/*	↓	Give	each	child	a	top	and	bottom	margin	*/
		margin-block:	var(--s1);
}

.cover	>	:first-child:not(h1)	{
		/*	↓	Remove	the	top	margin	from	the	first-child
		if	it	_doesn't_	match	the	centered	element	*/
		margin-block-start:	0;
}

.cover	>	:last-child:not(h1)	{
		/*	↓	Remove	the	bottom	margin	from	the	last-child
		if	it	_doesn't_	match	the	centered	element	*/
		margin-block-end:	0;
}

.cover	>	h1	{
		/*	↓	Center	the	centered	element	(h1	here)
		in	the	available	vertical	space	*/
		margin-block:	auto;
}

HTML

Assumes the centered element is an

<h1>

, and is in the

nth-child(2)

 position.

<div	class="cover">
		<div><!--	first	child	--></div>
		<h1><!--	centered	child	--></h1>
		<div><!--	third	child	--></div>
</div>

The	component

A custom element implementation of the Cover is available for

download
↗
.

Props	API

The following props (attributes) will cause the
 component to re-render when altered. They
Cover
can be altered by hand—in browser developer tools—or as the subjects of inherited application
state.

Name

centered

Type

string

"h1"

Default

Description

space

string

"var(--s1)"

minHeight

string

"100vh"

noPad

boolean

false

Examples

Basic

A simple selector such an
element or class selector,
representing the centered (main)
element in the cover

The minimum space between
and around all of the child
elements

The minimum height (block-size)
for the Cover

Whether the spacing is also
applied as padding to the
container element

Just a centered element (an
adopts the default

min-height

<h1>
 of

.
100vh

) with no header or footer companions. The context/parent

<cover-l>
		<h1>Welcome!</h1>
</cover-l>

⚠		One

<h1>

	per	page

For reasons of accessible document structure, there should only be one
page. This is the page’s main heading to screen reader users. If you add several successive

 element per

<h1>

s, all but the first should have an

<h2>

<cover-l>
structure.

 to indicate it is a

subsection

 in the document

The	Grid

The	problem

to
a
grid
Designers sometimes talk about designing
and vertical lines—in place first, then they populate that space, making the words and pictures
span the boxes those intersecting lines create.

. They put the grid—a matrix of horizontal

A 'grid first' approach to layout is only really tenable where two things are known ahead of time:

1.  The space
2.  The content

For a paper-destined magazine layout, like the one described in
attainable. For a screen and device-independent web layout containing dynamic (read:

, these things are

Axioms

changeable) content, they fundamentally are not.

The CSS Grid module is radical because it lets you place content anywhere within a predefined
grid, and as such brings
the placement of grid content, the more manual adjustment, in the form of
needed to adapt the layout to different spaces. Either the grid definition itself, the position of
content within it, or both will have to be changed by hand, and with additional code.

 to the web. But the more particular and deliberate

designing
to
a
grid

 breakpoints, is

@media

The
Switcher @media

As I covered in
 breakpoints pertain to viewport dimensions only, and not
the immediate available space offered by a parent container. That means layout components
defined using
modular design system.

 breakpoints are fundamentally not context independent: a huge issue for a

@media

,

It is not, even theoretically, possible to design
 in a context-independent, automatically
responsive fashion. However, it's possible to create basic grid-like formations: sets of elements
divided into both columns and rows.

to
a
grid

In

Every
Layout

,
we
design
with
content.
Without
content,
a
grid
needn't
exist;
with
content,
a
grid
formation
may
emerge
from
it

Compromise is inevitable, so it's a question of finding the most archetypal yet efficient solution.

Flexbox	for	grids

Using Flexbox, I can create a grid formation using
of the grid cells:

flex-basis

 to determine an

ideal

 width for each

.flex-grid	{
		display:	flex;
		flex-wrap:	wrap;
}

.flex-grid	>	*	{
		flex:	1	1	30ch;
}

The

display:	flex

 declaration defines the Flexbox context,

flex-wrap:	wrap

 allows wrapping, and

 says,

flex:	1	1	30ch
shrink
according
to
the
space
available"
based on a fixed grid schematic; it's determined
available space. The content and the context define the grid, not a human arbiter.

"the
ideal
width
should
be
30ch,
but
items
should
be
allowed
to
grow
and
. Importantly, the number of columns is not prescribed

 based on the

algorithmically

flex-basis

 and the

The
Switcher

In
'break' the grid shape under certain circumstances:

, we identified an interaction between

wrapping

 and

growth

 that leads items to

On the one hand, the layout takes up all its container's horizontal space, and there are no
unsightly gaps. On the other, a generic grid formation should probably make each of its items
align to both the horizontal and vertical rules.

Mitigation

Mitigation

You'll recall the global measure rule explored in the
applicable elements could not become wider than a comfortably readable line-length.

 section. This ensured all

Axioms

Where a grid-like layout created with Flexbox results in a full-width
 element, the
measure of its contained text elements would be in danger of becoming too long. Not with
that global measure style in place. The benefit of global rules (
consider each design principle per-layout. Many are already taken care of.

) is in not having to

:last-child

axioms

Grid

	for	grids

The aptly named CSS Grid module brings us closer to a 'true' responsive grid formation in one
specific sense: It's possible to make items grow, shrink, and wrap together
column boundaries.

without

 breaching the

This behavior is closer to the archetypal responsive grid I have in mind, and will be the layout we
pursue here. There's just one major implementation issue to quash. Consider the following code.

.grid	{
		display:	grid;
		grid-gap:	1rem;
		grid-template-columns:	repeat(auto-fit,	minmax(250px,	1fr));
}

This is the pattern, which I first discovered in Jen Simmon's
break it down:

Layout Land
↗

 video series. To

1.
2.

3.

4.

display:	grid

 sets the grid context, which makes grid cells for its children.
:

 places a 'gutter'
:

grid-gap
negative margin technique first described in
 Would ordinarily define a rigid grid for
:

grid-template-columns

).
The
Cluster

between

 each grid item (saving us from having to employ the

, but used with
 allows the dynamic spawning and wrappping of columns to create a

designing
to

 and

repeat
behavior similar to the preceding Flexbox solution.

auto-fit

 This function ensures each column, and therefore each cell of content shares a width
:
minmax
between a minimum and maximum value. Since
space, columns grow together to fill the container.

 represents one part of the available

1fr

The shortcoming of this layout is the minimum value in
minmax()
any amount of growing or shrinking from a single 'ideal' value,
limits.

. Unlike

minmax()

, which allows
flex-basis
 sets a scope with hard

Without a fixed minimum (
would just produce one row of ever-diminishing widths. But it being a fixed minimum has a clear
consequence: in any context narrower than the minimum, overflow will occur.

, in this case) there's nothing to

 the wrapping. A value of
0

trigger

250px

To put it simply: the pattern as it stands can only safely produce layouts where the columns
converge on a width that is below the estimated minimum for the container. About
reasonably safe because most handheld device viewports are no wider. But what if I want my
columns to grow considerably beyond this width, where the space is available? With Flexbox
and

 that is quite possible, but with CSS Grid it is not without assistance.

flex-basis

250px

 is

The	solution

 have handled sizing and wrapping with just
 queries. Sometimes it's not possible to rely on CSS alone for automatic

Each of the layouts described so far in
CSS, and without
reconfiguration. In these circumstances, turning to
because it undermines the modularity of the layout system. Instead, I
But I should do so

, and using progressive enhancement.

Every
Layout

judiciously

@media

@media

 breakpoints is out of the question,

might

 defer to JavaScript.

↗

 (soon to be

available in most modern browsers
↗
ResizeObserver
tracking and responding to changes in element dimensions. It is the most efficient method yet for
creating
course, but employed

 with JavaScript. I wouldn't recommend using it as a matter of

 for solving tricky layout issues is acceptable.

) is a highly optimized API for

container queries
↗

only

Consider the following code:

.grid	{
		display:	grid;
		grid-gap:	1rem;
}

.grid.aboveMin	{
		grid-template-columns:	repeat(auto-fit,	minmax(500px,	1fr));
}

The

aboveMin

 class presides over an overriding declaration that produces the responsive grid.

 is then instructed to add and remove the

ResizeObserver
container width. The minimum value of
container itself is wider than that threshold. Here is a standalone function to activate the

 (in the above example) is

 class depending on the

aboveMin

only

500px

 applied where the

ResizeObserver

 on a grid element.

function	observeGrid(gridNode)	{
		//	Feature	detect	ResizeObserver
		if	('ResizeObserver'	in	window)	{
				//	Get	the	min	value	from	data-min="[min]"
				const	min	=	gridNode.dataset.min;
				//	Create	a	proxy	element	to	measure	and	convert
				//	the	`min`	value	(which	might	be	em,	rem,	etc)	to	`px`
				const	test	=	document.createElement('div');
				test.style.width	=	min;
				gridNode.appendChild(test);
				const	minToPixels	=	test.offsetWidth;
				gridNode.removeChild(test);

				const	ro	=	new	ResizeObserver(entries	=>	{
						for	(let	entry	of	entries)	{
								//	Get	the	element's	current	dimensions
								const	cr	=	entry.contentRect;
								//	`true`	if	the	container	is	wider	than	the	minimum
								const	isWide	=	cr.width	>	minToPixels;
								//	toggle	the	class	conditionally
								gridNode.classList.toggle('aboveMin',	isWide);
						}
				});

				ro.observe(gridNode);
		}
}

ResizeObserver

 is not supported, the fallback one-column layout is applied perpetually. This

If
basic fallback is included here for brevity, but you could instead fallback to the serviceable-but-
imperfect Flexbox solution covered in the previous section. In any case, no content is lost or
obscured, and you have the ability to use larger
 minimum values for more expressive
grid formations. And since we're no longer bound to absolute limits, we can begin employing
relative units
.

minmax()

Here's an example initialization (code is elided for brevity):

<div	class="grid"	data-min="250px">
		<!--	Place	children	here	-->
</div>

<script>
		const	grid	=	document.querySelector('.grid');
		observeGrid(grid);
</script>

The

min()

	function

ResizeObserver

While it is worth covering
is actually no longer needed to solve this particular problem. That’s because we have the
recently widely adopted
↗
fact, write this layout without JavaScript after all.

 function. Sorry for the wild goose chase but we can, in

 because it may serve you well in other circumstances, it

 CSS

min()

As a fallback, we configure the grid into a single column. Then we use
and enhance from there:

@supports

 to test for

min()

.grid	{
		display:	grid;
		grid-gap:	1rem;
}

@supports	(width:	min(250px,	100%))	{
		.grid	{
				grid-template-columns:	repeat(auto-fit,	minmax(min(250px,	100%),	1fr));
		}
}

The way
That is:

min()

 works is it calculates the

shortest
length

min(250px,	100%)

 would return

100%

 where

250px

 from a set of comma-separated values.
 than the evaluated
 evaluates as

higher

100%

. This useful little algorithm

decides
for
us

 where the width must be capped at

100%

.

<watched-box>

If you are looking for a general solution for

container queries
↗

, I have created

<watched-box>

↗

. It’s straightforward and declarative, and it supports any CSS length units.

It is recommended
cases, one of the purely CSS-based layouts documented in
sensitive layout automatically.

<watched-box>

 is used as a “last resort” manual override. In all but unusual

Every
Layout

 will provide context

Use	cases

Grids are great for browsing teasers for permalinks or products. I can quickly compose a card
component to house each of my teasers using a

 and a

Stack

Box

.

This interactive demo is only available on the

Every
Layout

 site
↗
.

Shared	height

Each card shares the same height, regardless of its content, because the default value for
. This is fortuitous since few would expect different sized cards, or the

stretch

 is

align-items
unsightly gaps the unequal heights would create.

The	generator

Use this tool to generate basic

Grid

 CSS and HTML.

The code generator tool is only available in
basic solution, with comments:

the accompanying documentation site
↗

. Here is the

CSS

.grid	{
		/*	↓	Establish	a	grid	context	*/
		display:	grid;
		/*	↓	Set	a	gap	between	grid	items		*/
		grid-gap:	1rem;
		/*	↓	Set	the	minimum	column	width	*/
		--minimum:	20ch;
}

@supports	(width:	min(var(--minimum),	100%))	{
		.grid	{
				/*	↓	Enhance	with	the	min()	function
				into	multiple	columns	*/
				grid-template-columns:	repeat(auto-fit,	minmax(min(var(--minimum),	100%),	1fr));
		}
}

Implicit	single	column	layout

Note that
grid-template-columns
Implicitly, it is a single column grid unless

min()

 is supported.

 is not set except in the enhancement (

@supports

) block.

HTML

<div	class="grid">
		<div><!--	child	element	--></div>
		<div><!--	another	child	element	--></div>
		<div><!--	etc	--></div>
</div>

The	component

A custom element implementation of the Grid is available for

download
↗
.

Props	API

The following props (attributes) will cause the
 component to re-render when altered. They
Grid
can be altered by hand—in browser developer tools—or as the subjects of inherited application
state.

Type

string

string

Default

"250px"

Description

A CSS length value representing
x in minmax(min(x,	100%),	1fr)

"var(--s1)"

The space between grid cells

Name

min

space

Examples

Cards

The code for the cards example from
standard

. Note that the
. There's more on typographic measure in the

Use
cases

measure

min
Axioms

 rudiment.

 value is a fraction of the

<grid-l	min="calc(var(--measure)	/	3)">
		<box-l>
				<stack-l>
						<!--	card	content	-->
				</stack-l>
		</box-l>
		<box-l>
				<stack-l>
						<!--	card	content	-->
				</stack-l>
		</box-l>
		<box-l>
				<stack-l>
						<!--	card	content	-->
				</stack-l>
		</box-l>
		<box-l>
				<stack-l>
						<!--	card	content	-->
				</stack-l>
		</box-l>
		<!--	etc	-->
</grid-l>

The	Frame

The	problem

Some things exist as relationships. A line exists as the relationship between two points; without
both the points, the line cannot come into being.

When it comes to drawing lines, there are factors we don’t necessarily know, and others we
absolutely do. We don’t necessarily know where, in the universe, each of the points will appear.
 know that, no matter where the points appear,
That might be outside of our control. But we
we’ll be able to draw a straight line between them.

do

Connecting
randomly
placed
pairs
of
dots
makes
for
some
extremely
pedestrian
generative
art.

The position of the points is variable, but the nature of their relationship is constant. Capitalizing
on the constants that exist in spite of the variables is how we shape dynamic systems.

Aspect	ratio

Aspect ratio is another constant that comes up a lot, especially when working with images. You
find the aspect ratio by dividing the width of an image by its height.

<img	/>

The
 element is a
source to which it points.

replaced element
↗

; it is an element

replaced

 by the externally loaded

This source (an image file such as a PNG, JPEG, or SVG) has certain characteristics outside of
your control as a writer of CSS. Aspect ratio is one such characteristic, and is determined when
the image is originally created and cropped.

Making your images responsive is a matter of ensuring they don’t overflow their container. A

max-

inline-size

 value of

100%

 does just that.

img	{
		max-inline-size:	100%;
}

Global	responsive	images

Since this basic responsive behavior should be the default for all images, I apply the style with
a non-specific element selector. Not all of your styles are component-specific; read
and
local
styling

 for more info.

Global

Now the image’s width will match one of two values:

Its own intrinsic/natural width, based on the file data
The width of the horizontal space afforded by the container element

Importantly, the height—in either case—is determined by the aspect ratio. It’s the same as
writing
browsers.

, but that explicit declaration isn’t needed by modern, compliant

block-size:	auto

height	==	width	/	aspect	ratio

Sometimes we want to dictate the aspect ratio, rather than inheriting it from the image file. The
only way to achieve this without squashing, or otherwise distorting, the image is to dynamically
recrop it. Declaring
own
augmenting its

object-fit:	cover
 aspect ratio. The container becomes a window onto the undistorted image.

 on an image will do just that: crop it to fit the space without

What might be useful is a general solution whereby we can draw a rectangle, based on a given
aspect ratio, and make it a window onto any content we place within it.

The	solution

The first thing we need to do is find a way to give an arbitrary element an aspect ratio
hard-coding its width and height. That is, we need to make a container behave like a (replaced)
image.

without

For that, we have the

aspect ratio property
↗

 that would take an

x/n

 value:

.frame	{
		aspect-ratio:	16	/	9;
}

Before the advent of this property, we had to lean on
about as far back as 2009. The technique capitalizes on the fact that padding, even in the
vertical dimension, is relative to the element’s width. That is,
empty element (with no set height)
You find
9
opposite way around to finding the aspect ratio itself.

 by dividing   (representing the height) by

nine
sixteenths
as
high
as
it
is
wide

an intrinsic ratio technique
↗

 (representing the width) — the

padding-bottom:	56.25%

 — an aspect ratio of

56.25%

16

 first written

 will make an
.

16:9

Using custom properties and
left (numerator, or  ) and right (denominator, or  ) values of the ratio:

calc()

n

d

, we can create an interface that accepts any numbers for the

.frame	{
		padding-bottom:	calc(var(--n)	/	var(--d)	*	100%);
}

class="frame"

Assuming
match that of its parent. Whatever the calculated width value, the height is determined by
multiplying it by

block level element

), its width will automatically

 (such as a

.
9	/	16

 is a

<div>

support is now good for the

Since
instead of this elaborate hack.

aspect-ratio

 property
↗

, we can go ahead and use that

Cropping

So how does the cropping work? For replaced elements, like
just need to give them a

 width and height, along with

100%

object-fit:	cover

:

<img	/>

 and

<video	/>

 elements, we

.frame	{
		aspect-ratio:	16	/	9;
}

.frame	>	img,
.frame	>	video	{
		inline-size:	100%;
		block-size:	100%;
		object-fit:	cover;
}

Cropping	position

Implicitly, the complementary
is cropped around its center point. This is likely to be the most desirable cropping position
(since most images have a focal point somewhere towards their middle). Be aware that

 property’s value is

, meaning the media

object-position

50%	50%

object-position

 is at your disposal for adjustment.

object-fit

The
 property is not designed for normal, non-replaced elements, so we’ll have to
include something more to handle them. Fortunately, Flexbox justification and alignment can
have a similar effect. Since Flexbox has no affect on replaced elements, we can safely add these
styles to the parent, with

 preventing the content from escaping.

overflow:	hidden

.frame	{
		aspect-ratio:	16	/	9;
		overflow:	hidden;
		display:	flex;
		justify-content:	center;
		align-items:	center;
}

.frame	>	img,
.frame	>	video	{
		inline-size:	100%;
		block-size:	100%;
		object-fit:	cover;
}

Now any simple element will be placed in the center of the
or wider than the
cropped at the top
needed to cause cropping on the left and right. To make sure the cropping happens in all
contexts, and at all zoom levels, a  -based value will work.

 itself. If the element’s content makes it taller than the parent, it’ll be
 the bottom. Since inline content wraps, a specific set width might be

Frame
and

, and cropped where it is taller

Frame

%

⚠		Background	images

Another way to crop an image to cover its parent’s shape is to supply it as a background
image, and use
should be treated as

. For this implementation, we are assuming the image

, and therefore be supplied with

background-size:	cover

alternative text
↗
.

content

Background images cannot take alternative text directly, and are also removed by some high
contrast modes/themes some of your users may be running. Using a “real” image, via an

<img

/>

 tag, is usually preferable for accessibility.

Use	cases

Frame

 is mostly useful for cropping media (videos and images) to a desired aspect ratio.

The
Once you start controlling the aspect ratio, you can of course tailor it to the current
circumstances. For example, you might want to give images a different aspect ratio depending

on the viewport orientation.

It’s possible to achieve this by changing the custom property values via an orientation
query. In the following example, the
(rather than

 landscape) where there is relatively more vertical space available.

 elements of the previous example are made square

Frame

@media

16:9

@media	(orientation:	portrait)	{
		.frame	{
				aspect-ratio:	1	/	1;
		}
}

The Flexbox provision means you can crop any kind of HTML to the given aspect ratio, including
 elements if those are your chosen means of creating imagery. A set of card-like
<canvas>
components might each contain either an image or—where none is available—a textual fallback:

This interactive demo is only available on the

Every
Layout

 site
↗
.

The	generator

Use this tool to generate basic

Frame

 CSS and HTML.

The code generator tool is only available
with comments.

in the accompanying site
↗

. Here is the basic solution,

CSS

Replace the
aspect ratio.

--n

 (numerator) and

--d

 (denominator) values with whichever you wish, to create the

.frame	{
		--n:	16;	/*	numerator	*/
		--d:	9;	/*	denominator	*/
		aspect-ratio:	var(--n)	/	var(--d);
		overflow:	hidden;
		display:	flex;
		justify-content:	center;
		align-items:	center;
}

.frame	>	img,
.frame	>	video	{
		inline-size:	100%;
		block-size:	100%;
		object-fit:	cover;
}

HTML

The following example uses an image. There must be just one child element, whether it is a
replaced element or otherwise.

<div	class="frame">
		<img	src="/path/to/image"	alt="description	of	the	image	here"	/>
</div>

The	component

A custom element implementation of the Frame is available for

download
↗
.

Props	API

The following props (attributes) will cause the
can be altered by hand—in browser developer tools—or as the subjects of inherited application
state.

 component to re-render when altered. They

Frame

Name

ratio

Type

string

Default

"16:9"

Description

The element's aspect ratio

Examples

Image	frame

The custom element takes a

ratio

 expression, like

 (
4:3 16:9

 is the default).

<frame-l	ratio="4:3">
		<img	src="/path/to/image"	alt="description	of	the	image	here"	/>
</frame-l>

The	Reel

The	problem

When I’m sequencing music, I don’t know how long the track I’m creating is going to be until I’m
, as I add bars of
done. My sequencer software is aware of this and provisions time
sound. Just as music sequencers dynamically provision time, web pages provision space. If all
songs had to be four minutes and twenty six seconds long, or all web pages
would be needlessly restrictive.

on
demand

 high, well, that

768px

scrolling

The mechanism whereby the provisioned space can be explored within a fixed “viewport” is
called
. Without it, everyone’s devices would have to be exactly the same size, shape,
and magnification level at all times. Writing content for such a space would become a formalist
game, like writing haiku. Thanks to scrolling, you don’t have to worry about space when writing
web content. Writing for print does not have the same luxury.

writing-mode

 with which you are probably most familiar is

The CSS
. In this mode,
text and inline elements progress horizontally (either from left to right, as in English, or right to
left) and block elements flow from top to bottom (that’s the
wrap
elements are instructed to
is generally avoided. Because content is not permitted to reach
downwards
instead.

. The vertical progression of block elements inevitably triggers vertical scrolling

, the horizontal overflow which would trigger horizontal scrolling

 part). Since text and inline

 is resolves to reach

horizontal-tb

outwards

tb

As a Western reader, accustomed to the
horizontal-tb
conventional and expected. When you find the page needs to be scrolled vertically to see all the
content, you don’t think something has gone wrong. Where you encounter
it’s not only unexpected but has clear usability implications: where overflow follows writing
direction, each successive line of text has to be scrolled to be read.

 writing mode, vertical scrolling is

horizontal

 scrolling,

All this is not to say that horizontal scrolling is strictly forbidden within a
mode. In fact, where implemented deliberately and clearly, horizontally scrolling sections within a
vertically scrolling page can be an ergonomic way to browse content. Television streaming
services tend to dissect their content by category vertically and programme horizontally, for
bidirectionally
.
example. The one thing you really want to avoid are single elements that scroll
This is considered a failure under WCAG’s

1.4.10
Reflow

horizontal-tb

 criterion.

 writing

an accessible “carousel” component for the BBC
↗

I formalized
entirely to JavaScript for the browsing functionality—simply invokes native scrolling with
overflow. The browsing buttons provided are merely a progressive enhancement, and increment
the scroll position. Every Layout’s
 is similar, but foregoes the JavaScript to rely on standard
browser scrolling behavior alone.

 which—instead of deferring

Reel

The	solution

The
Cluster

As we set out in
Flexbox context. By applying
progressing downwards to progressing rightwards — at least where the default LTR (left-to-right)
writing

, an efficient way to change the direction of block flow is to create a

 to an element, its children will switch from

 is in effect.

display:	flex

direction

flex-wrap:	wrap

By omitting the often complementary
maintain a single-file formation. Where this line of content is longer than the parent element is
wide, overflow occurs. By default, this will cause the page itself to scroll horizontally. We don’t
want that, because it’s only our Flexbox content that actually needs scrolling. It would be better
that everything else stays still. So, instead, we apply
automatically invokes scrolling

 and only where overflow does indeed occur.

 declaration, elements are forced to

 to the Flex element, which

on
that
element

overflow:	auto

.reel	{
		display:	flex;
		/*	↓	We	only	want	horizontal	scrolling	*/
		overflow-x:	auto;
}

I’m yet to tackle affordance (making the element
spacing to address too, but this is the core of the layout. Because it capitalizes on standard
browser behavior, it’s extremely terse in code and robust — quite unlike your average
carousel/slider jQuery plugin.

 scrollable), and there’s the matter of

look

The	scrollbar

Scrolling is multimodal functionality: there are many ways to do it, and you can choose
whichever suits you best. While touch, trackpad gestures, and arrow key presses may be some
of the more ergonomic modes, clicking and dragging the scrollbar itself is probably the most
familiar, especially to older users on desktop. Having a visible scrollbar has two advantages:

1.  It allows for scrolling by dragging the scrollbar handle (or

"thumb"

)

2.  It indicates scrolling is available by this and other means (

increases
affordance
)

Some operating systems and browsers hide the scrollbar by default, but there are CSS methods
to reveal it. Webkit and Blink-based browsers proffer the following prefixed properties:

::-webkit-scrollbar	{
}
::-webkit-scrollbar-button	{
}
::-webkit-scrollbar-track	{
}
::-webkit-scrollbar-track-piece	{
}
::-webkit-scrollbar-thumb	{
}
::-webkit-scrollbar-corner	{
}
::-webkit-resizer	{
}

As of version 64, there are also limited opportunities to style the scrollbar in Firefox, with the
standardized
scrollbar-color
settings only take effect on MacOS where
General

 properties. Note that the

Show
scroll
bars

scrollbar-width

scrollbar-color

Settings
>

 is set to

Always

 and

 (in

).

Setting scrollbar colors is a question of aesthetics, which is not really what
about. But it’s important, for reasons of affordance, that scrollbars are
black and white styles are chosen just to suit
them as you wish.

Every
Layout’s

Every
Layout

 is

apparent

. The following

 own aesthetic. You can adjust

.reel	{
		display:	flex;
		/*	↓	We	only	want	horizontal	scrolling	*/
		overflow-x:	auto;
		/*	↓	First	value:	thumb;	second	value:	track	*/
		scrollbar-color:	var(--color-light)	var(--color-dark);
}

.reel::-webkit-scrollbar	{
		block-size:	1rem;
}

.reel::-webkit-scrollbar-track	{
		background-color:	var(--color-dark);
}

.reel::-webkit-scrollbar-thumb	{
		background-color:	var(--color-dark);
		background-image:	linear-gradient(var(--color-dark)	0,	var(--color-dark)	0.25rem,	var(--color-
light)	0.25rem,	var(--color-light)	0.75rem,	var(--color-dark)	0.75rem);
}

Not all properties are supported for these proprietary pseudo-classes. Hence, visually
the thumb is a question of painting a centered stripe using a
 rather than
attempting a margin or border.

linear-gradient

insetting

Height

What should the height of a
whole
best answer is

Reel

Reel

 instance be? Probably shorter than the viewport, so that the

 can be brought into view. But should we be setting a height at all? Probably not. The
, and is a question of the

"as
high
as
it
needs
to
be"

content

 height.

Reel

In the following demonstration, a
of the
content. Note that the last element of each “card” (a simple attribution) is pushed to the bottom
of the space, by using a

 is determined by the height of the tallest card, which is the card with the most

 element houses a set of card-like components. The height

.
splitAfter="2"

Stack

 with

Reel

This interactive demo is only available on the

Every
Layout

 site
↗
.

For images, which may be very large or use differing aspect ratios, we may want to
Reel’s
accordingly be
their own aspect ratio.

 height. The common image
, and the width

block-size height

horizontal-tb

 in a

100%

auto

 (

. This will ensure the images share a height but maintain

 writing mode) should

set

 the

.reel	{
		block-size:	50vh;
}

.reel	>	img	{
		block-size:	100%;
		width:	auto;
}

This interactive demo is only available on the

Every
Layout

 site
↗
.

Child	versus	descendant	selectors

Notice how we are using
 and not
images   they are the direct descendants (or
combinator.

.reel	>	img

if

.reel	img
children

. We only want to affect the layout of
) of the

. Hence, the   child

Reel

>

Spacing

Spacing out the child elements used to be a surprisingly tricky business. A border is applied
around the

 in this case, to give it its shape.

Reel

Until recently, we would have had to use margin and the adjacent sibling combinator to add a
space between the child elements. We use a logical property to ensure the
 works in both
writing directions.

Reel

.reel	>	*	+	*	{
		margin-inline-start:	var(--s1);
}

Now, since we’re in a Flexbox context, we are also able to use the
to the parent:

gap

 property, which is applied

.reel	{
		gap:	var(--s1);
}

The main advantage of
gap
elements wrap. Since the
solution instead. It’s longer and better supported.

 is ensuring the margins don’t appear in the wrong places when
 content is not designed to wrap, we shall use the
Reel’s

margin

-based

around

Adding spacing
trickier business. Unfortunately,
the right hand side is as if there were no padding at all:

 the child elements (in between them and the parent

.reel
padding interacts unexpectedly with scrolling
↗

 element) is a
. The effect on

So, if we want spacing around the children, we take a different approach. We add margin to all
but the right hand side of each child element, then insert space using pseudo-content on the last
of those children.

.reel	{
		border-width:	var(--border-thin);
}

.reel	>	*	{
		margin:	var(--s0);
		margin-inline-end:	0;
}

.reel::after	{
		content:	'';
		flex-basis:	var(--s0);
		/*	↓	Default	is	1	so	needs	to	be	overridden	*/
		flex-shrink:	0;
}

⚠		Cascading	border	styles

Here, we are only applying the border width, and not the border color or style. For this to take
effect, the
stylesheet, the
concern for most border cases:

 has to be applied somewhere already. In
universally

 the only ongoing

Every
Layout’s

 is applied

, making

border-style

border-width

border-style

 own

*,
*::before,
*::after	{
		border-style:	solid;
		/*	↓	0	by	default	*/
		border-width:	0;
}

The implementation to follow assumes you do not need padding on the
approach using

 therefore suffices.

.reel	>	*	+	*

Reel

 element itself; the

That just leaves the space between the children and the scrollbar (where present and visible) to
handle. Not a problem, you may think: just add some padding to the bottom of the parent
(
 is not
class="reel"
overflowing and the scrollbar has not been invoked.

 here). The trouble is, this creates a

 space wherever the

redundant

Reel

Ideally, there would be a pseudo-class for overflowing/scrolling elements. Then we could add
the padding selectively. Currently, the
 exists as little more
than an idea. For now, we can apply the margin, and remove it using JavaScript and a simple

 pseudo-class
↗

:overflowed-content

ResizeObserver
unavailable, or
Reel

. Innately, this is a progressive enhancement technique: where JavaScript is

ResizeObserver

 is not supported, the padding does not appear for an overflowing

 — but with little detrimental effect. It just presses the scrollbar up against the content.

const	reels	=	Array.from(document.querySelectorAll('.reel'));
const	toggleOverflowClass	=	elem	=>	{
		elem.classList.toggle('overflowing',	elem.scrollWidth	>	elem.clientWidth);
};

for	(let	reel	of	reels)	{
		if	('ResizeObserver'	in	window)	{
				new	ResizeObserver(entries	=>	{
						toggleOverflowClass(entries[0].target);
				}).observe(reel);
		}
}

Inside the observer, the
larger, the

overflowing

 class is added.

Reel’s scrollWidth

 is compared to its

clientWidth

. If the

scrollWidth

 is

.reel.overflowing	{
		padding-block-end:	var(--s0);
}

Concatentating	classes

See how the

reel

 and

overflowing

overflowing
be applied to other elements and components that might also take an

 styles defined here

Reel

only

overflowing

 class.

 classes are concatenated. This has the advantage that the
 components. That is, they can’t unwittingly

 apply to

Some developers use verbose namespacing to localize their styles, like prefixing each class
associated with a component with the component name (
 etc.). Deliberate
specification through class concatenation is less verbose and more elegant.

reel--overflowing

We’re not quite done yet, because we haven’t dealt with the case of child elements being
dynamically removed from the
. That will affect
toggling function and add a
almost ubiquitously supported
↗
.

scrollWidth
 that observes the

.
MutationObserver

MutationObserver

 too. We can abstract the class

childList

Reel

 is

const	reels	=	Array.from(document.querySelectorAll('.reel'));
const	toggleOverflowClass	=	elem	=>	{
		elem.classList.toggle('overflowing',	elem.scrollWidth	>	elem.clientWidth);
};

for	(let	reel	of	reels)	{
		if	('ResizeObserver'	in	window)	{
				new	ResizeObserver(entries	=>	{
						toggleOverflowClass(entries[0].target);
				}).observe(reel);
		}

		if	('MutationObserver'	in	window)	{
				new	MutationObserver(entries	=>	{
						toggleOverflowClass(entries[0].target);
				}).observe(reel,	{childList:	true});
		}
}

overkill

It’s fair to say this is a bit
 if only used to add or remove that bit of padding. But these
observers can be used for other enhancements, even beyond styling. For example, it may be
beneficial to keyboard users for an overflowing/scrollable
attribution. This would make the element focusable by keyboard and, therefore, scrollable using
the arrow keys. If each
 is focusable, or includes focusable content, this may not be
necessary: focusing an element automatically brings it into view by changing the scroll position.

child
element

 to take the

tabindex="0"

Reel

Use	cases

Reel

The
 is a robust and efficient antidote to carousel/slider components. As already discussed
and demonstrated, it is ideal for browsing categories of things: movies; products; news stories;
photographs.

In addition, it can be used to supplant button-activated menu systems. What Bradley Taunt calls
sausage links
↗
case, the visible scrollbar is probably rather heavy-handed. This is why the ensuing
element implementation

 may well be more usable than “hamburger” menus for many. For such a use

 includes a Boolean

 property.

custom

noBar

This interactive demo is only available on the

Every
Layout

 site
↗
.

There’s no reason why the links have to be shaped like sausages, of course! That’s just an
etymological hangover. One thing to note, however, is the lack of affordance the omitted
scrollbar represents. So long as the last visible child element on the right is partly obscured, it’s
relatively clear overflow is occurring and the ability to scroll is present. If this is not the case, it
may appear that all of the available elements are already in view.

From a layout perspective, you can reduce the likelihood of
avoiding certain types of width. Percentage widths like
because—at least in the absence of spacing—this will fit the elements exactly within the space.

"Everything
seems
to
be
here"
 or

 are going to be problematic

33.333%

 by

25%

In addition, you can indicate the availability of scrolling by other means. You can capitalize on
the observers’
perhaps):

 class to reveal a textual instruction (reading

"scroll
for
more"
,

overflowing

.reel.overflowing	+	.instruction	{
		display:	block;
}

current

However, this is not reactive to the
detect when the element is scrolled all the way to either side, and add
accordingly. The ever-innovative
images and CSS alone
↗
. Shadow background images take
remain at either end of the scrollable element. “Shadow cover” background images take

Lea Verou devised a way to achieve something similar using

 scroll position. You might use additional scripting to

background-attachment:	scroll

 classes

 and

start

 or

end

background-attachment:	local
scrollable area, these “shadow cover” backgrounds obscure the shadows beneath them.

 the content. Whenever the user reaches one end of the

, moving

with

These considerations don’t strictly relate to layout, more to communication, but are worth
exploring further to improve usability.

The	generator

Use this tool to generate basic

Reel

 CSS and HTML. You would want to include the

ResizeObserver
Immediately Invoked Function Expression (IIFE):

 script along with the code generated. Here’s a version implemented as an

(function()	{
		const	className	=	'reel';
		const	reels	=	Array.from(document.querySelectorAll(`.${className}`));
		const	toggleOverflowClass	=	elem	=>	{
				elem.classList.toggle('overflowing',	elem.scrollWidth	>	elem.clientWidth);
		};

		for	(let	reel	of	reels)	{
				if	('ResizeObserver'	in	window)	{
						new	ResizeObserver(entries	=>	{
								toggleOverflowClass(entries[0].target);
						}).observe(reel);
				}

				if	('MutationObserver'	in	window)	{
						new	MutationObserver(entries	=>	{
								toggleOverflowClass(entries[0].target);
						}).observe(reel,	{childList:	true});
				}
		}
})();

. Here is the basic solution,
The code generator tool is only available
with comments. The code that hides the scrollbar has been removed for brevity, but is available
via the

custom element implementation
.

in the accompanying site
↗

 property in the

noBar

HTML

<div	class="reel">
		<div><!--	child	element	--></div>
		<div><!--	another	child	element	--></div>
		<div><!--	etc	--></div>
		<div><!--	etc	--></div>
</div>

CSS

.reel	{
		/*	↓	Custom	properties	for	ease	of	adjustment	*/
		--space:	1rem;
		--color-light:	#fff;
		--color-dark:	#000;
		--reel-height:	auto;
		--item-width:	25ch;
		display:	flex;
		block-size:	var(--reel-height);
		/*	↓	Overflow	*/
		overflow-x:	auto;
		overflow-y:	hidden;
		/*	↓	For	Firefox	*/
		scrollbar-color:	var(--color-light)	var(--color-dark);
}

reel-l::-webkit-scrollbar	{
		/*
		↓	Instead,	you	could	make	the	scrollbar	height
		a	variable	too.	This	is	left	as	an	exercise
		(be	mindful	of	the	linear-gradient!)
		*/
		block-size:	1rem;
}

reel-l::-webkit-scrollbar-track	{
		background-color:	var(--color-dark);
}

reel-l::-webkit-scrollbar-thumb	{
		background-color:	var(--color-dark);
		/*	↓	Linear	gradient	‘insets’	the	white	thumb	within	the	black	bar	*/
		background-image:	linear-gradient(var(--color-dark)	0,	var(--color-dark)	0.25rem,	var(--color-
light)	0.25rem,	var(--color-light)	0.75rem,	var(--color-dark)	0.75rem);
}

.reel	>	*	{
		/*
		↓	Just	a	`width`	wouldn’t	work	because
		`flex-shrink:	1`	(default)	still	applies
			*/
		flex:	0	0	var(--item-width);
}

reel-l	>	img	{
		/*	↓	Reset	for	images	*/
		block-size:	100%;
		flex-basis:	auto;
		width:	auto;
}

.reel	>	*	+	*	{
		margin-inline-start:	var(--space);
}

.reel.overflowing:not(.no-bar)	{
		/*	↓	Only	apply	if	there	is	a	scrollbar	(see	the	JavaScript)	*/
		padding-block-end:	var(--space);
}

/*	↓	Hide	scrollbar	with	`no-bar`	class	*/
.reel.no-bar	{
		scrollbar-width:	none;
}

.reel.no-bar::-webkit-scrollbar	{
		display:	none;
}

JavaScript

Just an Immediately Invoked Function Expression (IIFE):

(function()	{
		const	className	=	'reel';
		const	reels	=	Array.from(document.querySelectorAll(`.${className}`));
		const	toggleOverflowClass	=	elem	=>	{
				elem.classList.toggle('overflowing',	elem.scrollWidth	>	elem.clientWidth);
		};

		for	(let	reel	of	reels)	{
				if	('ResizeObserver'	in	window)	{
						new	ResizeObserver(entries	=>	{
								for	(let	entry	of	entries)	{
										toggleOverflowClass(entry.target);
								}
						}).observe(reel);
				}

				if	('MutationObserver'	in	window)	{
						new	MutationObserver(entries	=>	{
								for	(let	entry	of	entries)	{
										toggleOverflowClass(entry.target);
								}
						}).observe(reel,	{childList:	true});
				}
		}
})();

The	component

A custom element implementation of the Reel is available for

download
↗
.

Props	API

 component to re-render when altered. They
The following props (attributes) will cause the
Reel
can be altered by hand—in browser developer tools—or as the subjects of inherited application
state.

Type

string

string

string

boolean

Default

"auto"

"var(--s0)"

"auto"

false

Description

The width of each item (child
element) in the Reel

The space between Reel items
(child elements)

The height of the Reel itself

Whether to display the scrollbar

Name

itemWidth

space

height

noBar

Examples

Card	slider

In this example, cards are given a
circumstance, since the horizontal space is provisioned as needed, and wrapping takes care of
text and inline elements: the cards are allowed to grow

 width. Note that a “fixed” width is acceptable in this

downwards

20rem

.

<reel-l	itemWidth="20rem">
		<box-l>
				<stack-l>
						<!--	card	content	-->
				<stack-l>
		</box-l>
		<box-l>
				<stack-l>
						<!--	card	content	-->
				<stack-l>
		</box-l>
		<box-l>
				<stack-l>
						<!--	card	content	-->
				<stack-l>
		</box-l>
		<!--	ad	infinitum	-->
</reel-l>

Slidable	links

Note the use of
screen reader output. This is customary for navigation regions.

role="listitem"

role="list"

 and

 to communicate the component as a list in

<reel-l	role="list"	noBar>
		<div	role="listitem">
				<a	class="cta"	href="/path/to/home">Home</a>
		</div>
		<div	role="listitem">
				<a	class="cta"	href="/path/to/about">About</a>
		</div>
		<div	role="listitem">
				<a	class="cta"	href="/path/to/pricing">Pricing</a>
		</div>
		<div	role="listitem">
				<a	class="cta"	href="/path/to/docs">Documentation</a>
		</div>
		<div	role="listitem">
				<a	class="cta"	href="/path/to/testimonials">Testimonials</a>
		</div>
</reel-l>

The	Imposter

The	problem

Positioning in CSS, using one or more instances of the

position

 property’s

,
relative absolute

, and

 values, is like manually overriding web layout. It is to switch off automatic layout and take

fixed
matters into your own hands. As with piloting a commercial airliner, this is not a responsibility
you would wish to undertake except in rare and extreme circumstances.

In the
Frame
layout algorithms:

 documentation, you were warned of the perils of eschewing the browser’s standard

When
you
give
an
element

position:	absolute
natural
flow
of
the
document.
It
lays
itself
out
as
if
the
elements
around
it
don’t
exist.
In
most
circumstances
this
is
highly
undesirable,
and
can
easily
lead
to
problems
like
overlapping
and
obscured
content.

,
you
remove
it
from
the

wanted

But what if you
working in web development for more than 23 minutes, it’s likely you have already done this, in
the incorporation of a dialog element, “popup”, or custom dropdown menu.

 to obscure content, by placing other content over it? If you’ve been

The purpose of the
 element is to add a general purpose
your layouts suite. It will allow the author to centrally position an element over the viewport, the
document, or a selected “positioning container” element.

superimposition

 element to

Imposter

The	solution

There are many ways to centrally position elements vertically, and many more to centrally
position them horizontally (some alternatives were mentioned as part of the
However, there are only a few ways to position elements centrally

Center

over

 other elements/content.

 layout).

The contemporaneous approach is to
arrange content by grid line number. The concept of
is eminently achievable wherever desired.

use CSS Grid
↗

. Once your grid is established, you can

flow
↗

 is made irrelevant, and overlapping

Source	order	and	layers

Source	order	and	layers

Whether you are positioning content according to Grid lines or doing so with the
property, which elements appear
if two elements share the same space, the one that appears
that comes last in the source.

above

over

 which is, by default, a question of source order. That is:

 the other will be the one

position

Since
you
can
place
any
elements
along
any
grid
lines
you
wish,
an
overlapping
last-in-source
element
can
appear
first
down
the
vertical
axis

This is often overlooked, and some believe that

z-index

 needs to accompany

position:

 in all cases to determine the “layering”. In fact,

absolute
want to layer positioned elements irrespective of their source order. It’s another kind of
override, and should be avoided wherever possible.

 is only necessary where you

z-index

An arms race of escalating
things you have to deal with using CSS. I rarely have
positioning, and I’m mindful of source order when I do.

z-index

 values is often cited as one of those irritating but necessary

z-index

 problems, because I rarely use

CSS Grid does not precipitate a general solution, because it would only work where your
positioning element is set to
We need something more flexible.

 ahead of time, and the column/row count is suitable.

display:	grid

Positioning

You can position an element to one of three things (“

positioning
contexts

” from here on):

1.  The viewport

2.  The document
3.  An ancestor element

To position an element relative to the viewport, you would use
relative to the document, you use

position:	absolute

.

position:	fixed

. To position it

positioning
” from here on) is also explicitly positioned. The easiest way to do this is to give the

Positioning it relative to an ancestor element is possible where that element (the “
container
ancestor element
the position of the ancestor element, or taking it out of the document flow.

. This sets the localized positioning context

position:	relative

without

 moving

The

static

value
for
the

position

property
is
the
default,
so
you
will
rarely
see
or
use
it
except
to
reset
the
value.

Centering

How do we position the
positioning container? For positioned elements, techniques like

 element over the

Imposter

center

 of the document, viewport, or

margin:	auto
, we have to use a combination of the

 or
place-items:
,
,
,
top left bottom

 do not work. In

center
and/or
positioning context—not to the immediate parent element.

manual
override

right

 properties. Importantly, the values for each of these properties relate to the

The

static

value
for
the

position

property
is
the
default,
so
you
will
rarely
see
or
use
it.

So far, so bad: we want the element itself to be centered, not its top corner. Where we know the

width

 of the element, we can compensate by using negative margins. For example,
 will recenter an element that is

margin-block-start:	-10rem

 and

margin-

40rem

 wide

inline-start:	-20rem
and

20rem

 tall (the negative value is always half the dimension).

We avoid hard coding dimensions because, like positioning, it dispenses with the browser’s
algorithms for arranging elements according to available space. Wherever you code a fixed
width on an element, the chances of that element or its contents becoming obscured on
somebody’s
element’s width or height ahead of time. So we wouldn’t know which negative margin values
with which to complement it.

 are close to inevitable. Not only that, but we might not know the

somewhere

 device

Instead of designing layout, we design
this case, it’s a question of using transforms. The
according to their own dimensions, whatever they are at the given time. In short:

for
layout

transform

 property arranges elements

, allowing the browser to have the final say. In

transform:

translate(-50%,	-50%)
respectively. We don’t need to know the element’s dimensions ahead of time, because the
browser can calculate them and act on them for us.

 the element’s position by -50% of its

translate

 width and height

 will

own

Centering the element over its positioning container, no matter its dimensions, is therefore quite
simple:

.imposter	{
		/*	↓	Position	the	top	left	corner	in	the	center	*/
		position:	absolute;
		inset-block-start:	50%;
		inset-inline-start:	50%;
		/*	↓	Reposition	so	the	center	of	the	element
		is	the	center	of	the	positioning	container	*/
		transform:	translate(-50%,	-50%);
}

It should be noted at this point that a block-level
longer takes up the available space along the element’s writing direction (usually horizontal; left-
to-right). Instead, the element “shrink wraps” its content as if it were inline.

 element set to

position:	absolute

Imposter

 no

width

By default, the element’s
positioning container. If you add an explicit
will continue to be centered within the positioning container — the internal translation algorithm
sees to that.

 will be 50%, or less if its content takes up less than 50% of the
 the element

, it will be honoured

height

width

and

 or

Overflow

What if the positioned
 element becomes wider or taller than its positioning container?
With careful design and content curation, you should be able to create the generous tolerances
that prevent this from happening under most circumstances. But it may still happen.

Imposter

By default, the effect will see the
container — and may be in danger of obscuring content around that container. In the following
illustration, an

 is taller than its positioning container.

 over the edges of the positioning

Imposter poking
out

Imposter

 and

max-width

Since
 and
dimensions—or minimum dimensions—but still ensure the element is contained. All that’s left is
to add

 to ensure the constricted element’s contents can be scrolled into view.

 respectively, we can allow authors to set

overflow:	auto

 override

max-height

height

width

.imposter	{
		position:	absolute;
		/*	↓	equivalent	to	`top`	in	horizontal-tb	writing	mode	*/
		inset-block-start:	50%;
		/*	↓	equivalent	to	`left`	in	horizontal-tb	writing	mode	*/
		inset-inline-start:	50%;
		transform:	translate(-50%,	-50%);
		/*	↓	equivalent	to	`max-width`	in	horizontal-tb	writing	mode	*/
		max-inline-size:	100%;
		/*	↓	equivalent	to	`max-height`	in	horizontal-tb	writing	mode	*/
		max-block-size:	100%;
}

Margin

In some cases, it will be desirable to have a minimum gap (space; margin; whatever you want to
 element and the inside edges of its positioning container. For two
call it) between the
reasons, we can’t achieve this by adding padding to the positioning container:

Imposter

1.  It would inset any static content of the container, which is likely not to be a desirable visual

effect

2.  Absolute positioning does not respect padding: our

Imposter

 element would ignore and

overlap it

The answer, instead, is to adjust the
especially useful for making these kinds of adjustments.

max-width

 and

max-height

 values. The

calc()

 function is

.imposter	{
		position:	absolute;
		inset-block-start:	50%;
		inset-inline-start:	50%;
		transform:	translate(-50%,	-50%);
		max-inline-size:	calc(100%	-	2rem);
		max-block-size:	calc(100%	-	2rem);
}

The above example would create a minimum gap of
removed for each end.

1rem

 on all sides: the

2rem

 value is

1rem

Fixed	positioning

Imposter

Where you wish the
element (read: positioning container) within the document, you should replace
with
scroll the document, and remain in view until tended to.

 to be fixed relative to the

position:	fixed

viewport

. This is often desirable for dialogs, which should follow the user as they

, rather than the document or an

position:	absolute

In the following example, the
default value of

absolute

.

Imposter

 element has a

--positioning

 custom property with a

.imposter	{
		position:	var(--positioning,	absolute);
		inset-block-start:	50%;
		inset-inline-start:	50%;
		transform:	translate(-50%,	-50%);
		max-inline-size:	calc(100%	-	2rem);
		max-block-size:	calc(100%	-	2rem);
}

As described in the
can override this default value inline, inside a

Every
Layout

 article

Dynamic CSS Components Without JavaScript
↗

, you

style

 attribute for special cases:

<div	class="imposter"	style="--positioning:	fixed">
		<!--	imposter	content	-->
</div>

In the custom element implementation to follow (under
mechanism takes the form of a Boolean
 positioning that is default.

absolute

fixed

The
Component

) an equivalent

 prop’. Adding the

fixed

 attribute overrides the

⚠		Fixed	positioning	and	Shadow	DOM

⚠		Fixed	positioning	and	Shadow	DOM

In most cases, using a
viewport. That is, any candidate positioning containers (positioned ancestor elements) will be
ignored.

 will position the element relative to the

 value for

position

fixed

 host element will be treated as the outer element of a nested

↗

shadowRoot

However, a
document. Therefore, any element with
be positioned relative to the
shadowRoot
effect, it becomes a positioning container as in previous examples.

position:	fixed

 host (the element that hosts the Shadow DOM). In

 found inside Shadow DOM will instead

Use	cases

Wherever content needs to be deliberately obscured, the
Imposter
be that the content is yet to be made available. In which case, the
call-to-action to unlock that content.

 pattern is your friend. It may
Imposter

 may consist of a

This interactive demo is only available on the

Every
Layout

 site
↗
.

It may be that the artifacts obscured by the
be revealed in full.

Imposter

 are more decorative, and do not need to

When creating a dialog using an
Imposter
to be included—especially those relating to keyboard focus management.
 has a chapter on dialogs which describes these considerations in detail.

, be wary of the accessibility considerations that need
Inclusive Components

↗

The	generator

Use this tool to generate basic

Imposter

 CSS and HTML.

The code generator tool is only available in
basic solution, with comments. The
container, and handles overflow.

.contain

the accompanying documentation site
↗
 version contains the element within its positioning

. Here is the

CSS

.imposter	{
		/*	↓	Choose	the	positioning	element	*/
		position:	var(--positioning,	absolute);
		/*	↓	Position	the	top	left	corner	in	the	center	*/
		inset-block-start:	50%;
		inset-inline-start:	50%;
		/*	↓	Reposition	so	the	center	of	the	element
		is	the	center	of	the	container	*/
		transform:	translate(-50%,	-50%);
}

.imposter.contain	{
		/*	↓	Include	a	unit,	or	the	calc	function	will	be	invalid	*/
		--margin:	0px;
		/*	↓	Provide	scrollbars	so	content	is	not	obscured	*/
		overflow:	auto;
		/*	↓	Restrict	the	height	and	width,	including	optional
		spacing/margin	between	the	element	and	positioning	container	*/
		max-inline-size:	calc(100%	-	(var(--margin)	*	2));
		max-block-size:	calc(100%	-	(var(--margin)	*	2));
}

HTML

An ancestor with a positioning value of
“positioning container” over which the
 with the
a simple

position:	relative

<div>

 inline style is used.

relative

.imposter

absolute

 or
 must be provided. This becomes the
 element is positioned. In the following example,

<div	style="position:	relative">
		<p>Static	content</p>
		<div	class="imposter">
				<p>Superimposed	content</p>
		</div>
</div>

The	component

A custom element implementation of the Imposter is available for

download
↗
.

Props	API

The following props (attributes) will cause the
They can be altered by hand—in browser developer tools—or as the subjects of inherited
application state.

 component to re-render when altered.

Imposter

Type

Default

Description

boolean

false

string

0

boolean

false

Whether the element is allowed
to break out of the container
over which it is positioned

The minimum space between the
element and the inside edges of
the positioning container over
which it is placed (where
is not applied)

breakout

Whether to position the element
relative to the viewport

Name

breakout

margin

fixed

Examples

Demo	example

The code for the demo in the
superimposed sibling content. It’s likely the superimposed content should be unavailable to
screen readers, since it is unavailable (or at least mostly obscured) visually.

 section. Note the use of

aria-hidden="true"

Use
cases

 on the

<div	style="position:	relative">
		<text-l	words="150"	aria-hidden="true"></text-l>
		<imposter-l>
				<box-l	style="background-color:	var(--color-light)">
						<p	class="h4"><strong>You	can’t	see	all	the	content,	because	of	this	box.</strong></p>
				</box-l>
		</imposter-l>
</div>

Dialog

Imposter

 element could take the ARIA attribute
The
role="dialog"
dialog in screen readers. Or, more simply, you could just place a
Note that the
fixed
the dialog would stay centered in the viewport as the document is scrolled.

 here, to switch from an

<dialog>
 to

Imposter

 takes

absolute

fixed

 to be communicated as a
 inside the

.
Imposter

 position. This means

<imposter-l	fixed>
		<dialog	aria-labelledby="message">
				<p	id="message">It’s	decision	time,	sunshine!</p>
				<button	type="button">Yes</button>
				<button	type="button">No</button>
		</dialog>
</imposter-l>

The	Icon

The	problem

Most of the layouts in
expression. That is, they set a
elements in their control. As you will discover in

block-level
↗

Every
Layout

 take the form of

,
block flex
elements in a special way).

, or

grid

 are themselves block-level (

flex

block
components

, if you’ll excuse the
 context wherein they affect the layout of child

Boxes
 and

, elements with display values of either
 differ by affecting their child

grid

Here, we shall be looking at something a lot smaller, and it doesn’t get much smaller than an
icon. This will be the first layout for which the
mode.

 will retain its default

custom element

inline

 display

Getting things to line up and look right,
icons, we have to worry about things like:

inline

 can be a precarious business. When it comes to

The distance between the icon and the text
The height of the icon compared with the height of the text
The vertical alignment of the icon to the text
What happens when the text comes
What happens when you resize the text

after

 the icon, rather than before

A	simple	icon

Before looking into any of these, I’m first going to give you a really quick crash course in SVG
iconography, since SVG is the
code:

 iconography format on the web. Consider the following

de
facto

<svg	viewBox="0	0	10	10"	width="0.75em"	height="0.75em"	stroke="currentColor"	stroke-width="2">
		<line	x1="1"	y1="1"	x2="9"	y2="9"	/>
		<line	x1="9"	y1="1"	x2="1"	y2="9"	/>
</svg>

This defines a simple icon: a cross. Let me explain each of the key features:

: This defines the coordinate system for the SVG. The

viewBox
top
left
corner”
vertical, coordinates. We are defining a square, since all our icons will occupy a square

 part means give the SVG “canvas” 10 horizontal, and 10

 part means

 and the

“10
10”

0	0

“count
from
the

space.

0.75em

height

and

: This sets the size of the icon. I shall explain why it uses the

width
set to
than in CSS, because we want to keep the icon small even if CSS fails to load. SVGs are
displayed very large in most browsers by default.

 shortly. For now, be aware that we set the width and height

 unit, and is
 the SVG, rather

on

em

and

stroke-width

stroke
form. They can be written, or overridden, in CSS. But since we aren’t using many, it’s better
to make sure these too are CSS-independent.

: These presentational attributes give the

 elements visible

<line	/>

: The

<line	/>

 element draws a simple line. Here we have one drawn from the top left

<line	/>
to the bottom right, followed by one drawn from the top right to the bottom left (making our
cross). I’m using   and  , not   and
1
Otherwise the line would overflow the SVG “canvas”.

, to compensate for the line’s

stroke-width

 of  .
2

10

9

0

There are many ways to draw the same cross shape. Perhaps the most efficient is to use a

<path

 element. A path lets you place all the coordinates in one  attribute. The   symbol marks the

d

M

/>
start of each line’s separate coordinates:

<svg	viewBox="0	0	10	10"	width="0.75em"	height="0.75em"	stroke="currentColor"	stroke-width="2">
		<path	d="M1,1	9,9	M9,1	1,9"	/>
</svg>

When your SVG data is this terse, there’s no reason not to include it

inline

 rather than using an

<img	/>

 pointing to an SVG

src

 file.

currentColor

There are other advantages besides being able to dispense with an HTTP request, like the ability
to use
 as shown. This keyword makes your inline SVG adopt the
surrounding text. For the demo icons to follow, the icons are included via the
which references one of many icon
HTTP request). The

 of the
 element,
 file (and therefore

 technique still works when referencing SVG data in this way.

s defined in a single

icons.svg

currentColor

<symbol>

color

<use>

<svg	class="icon">
		<use	href="/images/icons/icons.svg#cross"></use>
</svg>

In any case, SVG is an efficient
images like PNGs, and without the attendant

scalable

 format, much better suited to iconography than raster

accessibility issues
↗

 of icon fonts.

Our task here is to create a dependable SVG canvas for square icons, and ensure it fits
seamlessly alongside text, with the minimum of manual configuration.

The	solution

Vertical	alignment

As the previous note on
them to accompany text as seamlessly as possible. Fortunately, the SVG will sit on the text’s

 suggests, we are going to treat our icons like text, and get

currentColor

baseline

 by default, as if it were a letter.

For taller icons, you may expect to be able to use
popular belief this does not align around the vertical middle of the font, but
the
lowercase
letters
of
the
font

. Hence, the result will probably be undesirable.

vertical-align:	middle

. However, contrary to

the
vertical
middle
of

Instead, adjusting the vertical alignment for a taller icon will probably be a matter of supplying
the
and can take a negative value.

 attribute with a length. This length represents the distance above the baseline,

vertical-align

Icon

 layout, we shall stick to sitting icons on the baseline. This is the most robust

For our
approach since icons that hang below the baseline may collide with a successive line of text
where wrapping occurs.

Matching	height

A suitable icon height, starting at the baseline, depends somewhat on the casing of the font and
the presence or absence of
descenders, things can look particularly unbalanced.

. Where the letters are all lowercase, and include

descenders
↗

This interactive demo is only available on the

Every
Layout

 site
↗
.

This perceptual issue can be mitigated by ensuring the first letter of the icon’s accompanying
text is always uppercase, and that the icon itself is the height of an uppercase letter.

 to
Actually matching the uppercase letter height
be the value, but that is rarely the case.
 more closely matches the height of the font itself. By
making selections of text from a few fonts, you’ll see the font height is often taller than its capital
letters. To put it another way:

 corresponds to font metrics, not letter metrics.

 is another matter. You might expect

per
font

1em

1em

1em

In my experimentation, I found that
the presentation attributes for my cross icon being
precedent set by the

viewBox

0.75em

.

 more closely matches uppercase letter height. Hence,

0.75em

 each, to make a square following the

<svg	viewBox="0	0	10	10"	width="0.75em"	height="0.75em"	stroke="currentColor"	stroke-width="2">
		<path	d="M1,1	9,9	M9,1	1,9"	/>
</svg>

From
left
to
right:
Arial,
Georgia,
Trebuchet,
and
Verdana.
For
each
icon,

0.75em

matches
the
uppercase
letter
height.

However, the
match. Since it is currently not supported very well, we can use

emerging

 unit
↗

cap

 promises to evaluate the individual font for a more accurate

0.75em

 as a fallback in our CSS:

.icon	{
		height:	0.75em;
		height:	1cap;
		width:	0.75em;
		width:	1cap;
}

Better to have the
0.75em
presentational attributes.

 values in the CSS as well, in case an author has omitted the

Height	and	width	are	not	logical?

Generally, we should use logical properties to make our measurements compatible with a
 are the same, the writing
wider range of languages. In this case, since the
mode doesn’t matter. We use
 for the more
longstanding browser support.

inline-size

block-size

 over

 and

 and

 and

height

height

width

width

As Andy wrote in
text:

0.75em

Relative Sizing With EM units
↗
font-size

 is relative to the

 for the context. For example:

, the icon will now scale automatically with the

.small	{
		font-size:	0.75em;
}

.small	.icon	{
		/*	Icon	height	will	automatically	be
				0.75	*	0.75em	*/
}

.big	{
		font-size:	1.25em;
}

.big	.icon	{
		/*	Icon	height	will	automatically	be
				1.25	*	0.75em	*/
}

This interactive demo is only available on the

Every
Layout

 site
↗
.

Matching	lowercase	letter	height

If your icon text is to be lowercase, you may bet better results by matching the icon height to
a lowercase letter. This is already possible using the
 unit which pertains to the height of a
lowercase ‘x’. You might want to enforce lowercase type as well.

ex

.icon	{
		width:	1ex;
		height:	1ex;
}

/*	Assume	this	is	the	parent	or	ancestor	element	for	the	icon	*/
.with-icon	{
		text-transform:	lowercase;
}

Spacing	between	icon	and	text

To establish how we manage the spacing of our icons, we have to weigh efficiency against
flexibility. In design systems, sometimes inflexibility can be a virtue, since it enforces regularity
and consistency.

Consider our cross icon in context, inside a button element and alongside the text “Close”:

<button>
		<svg	class="icon">...</svg>	Close
</button>

Note the space (unicode point U+0020, if you want to be scientific) between the SVG and the
text node. This adds a visible space between the icon and the text, as I’m sure you can imagine.
Now, you don’t have control over this space. Even adding an extra space of the same variety in
the source will not help you, since it will be collapsed down to a single space by the browser.
But it is a
Again, we are treating the icon like text.

 space, because it matches the space between any words in the same context.

suitable

A couple of other neat things about using simple text spacing with your icons:

1.  If the icon appears on its own, the space does not appear (making the spacing inside the

2.  You can use the

button look uneven) even if it remains in the source. It is collapsed under this condition too.
 (right-to-left) value to swap the icon visually from
 the icon and text becuse the text direction,

 attribute with the
left to right. The space will still appear
including the spacing, has been reversed.

rtl
between

dir

<button	dir="rtl">
		<svg	class="icon"></svg>	Close
</button>

It’s neat when we can use a fundamental feature of HTML to reconfigure our design, rather than
having to write bespoke styles and attach them to arbitrary classes.

do

 want control of the length of the space, you have to accept an increase in complexity,

If you
and a diminishing of reusability: It’s not really possible without setting a context for the icon in
order to remove the extant space first. In the following code, the context is set by the
element and the word space eliminated by making it

.
inline-flex

.with-icon

.icon	{
		height:	0.75em;
		height:	1cap;
		width:	0.75em;
		width:	1cap;
}

.with-icon	{
		display:	inline-flex;
		align-items:	baseline;
}

inline-flex

 display value behaves as its name suggests: it creates a

The
element creating that context itself displays as inline. Employing
space, freeing us to create a space/gap purely with margin.

inline-flex

flex

 context, but the
 eliminates the word

Now we can add some margin. How do we add it in such a way that it always appears in the
correct place, like the space did? If I use
left, before the text. But if I add
wrong side.

, it will work where the icon is on the
margin-right:	0.5em
 that margin remains on the right, creating a gap on the

dir="rtl"

The answer is

margin-left
direction of the
.
Boxes

 all pertain to

CSS Logical Properties
↗
physical
 orientation and placement, logical properties honor instead the
. This differs depending on the flow and writing direction, as explained in

margin-top margin-right margin-bottom

content

. While

, and

,

,

In this case, I would use
margin-inline-end
element in the direction of the text (hence

-inline-

):

 with the icon element. This applies margin

after

 the

.icon	{
		height:	0.75em;
		height:	1cap;
		width:	0.75em;
		width:	1cap;
}

.with-icon	{
		display:	inline-flex;
		align-items:	baseline;
}

.with-icon	.icon	{
		margin-inline-end:	var(--space,	0.5em);
}

One disadvantage with this more flexible approach to spacing is that the margin remains even
where text is not supplied. Unfortunately, although you can target lone elements with
you cannot target lone elements
the margin with just CSS.

unaccompanied
by
text
nodes

. So it is not possible to remove

,
:only-child

Instead, you could just remove the
manual spacing by
described). In the
the

 be made an

<icon-l>

inline-flex

margin

with-icon

 class, since it only creates the conditions for

. This way, spaces will remain (and collapse automatically as

custom element implementation to come

space
 element, and the word space removed.

, only if the

 prop is supplied will

Use	cases

You’ve seen icons before, right? Most frequently you find them as part of button controls or
links, supplementing a label with a visual cue. Too often our controls
for highly familiar icons/symbols like the cross icon from previous examples, but more esoteric
icons should probably come with a textual description — at least in the early stages of the
interface’s usage.

 use icons. This is okay

only

Where no (visible) textual label is provided, it’s important there is at least a screen reader
perceptible label of some form. You can do one of the following:

Visually hide
↗

 a textual label (probably supplied in a

)
<span>

1.
2.  Add a
3.  Add an

<title>

 to the

<svg>

aria-label

 directly to the parent

<button>

 element

label

, if a

 and

role="img"

component

 prop is added to

In the
with
outside
value read out. Where
The pseudo-image element is simply purposed as the label.

aria-label="[the	label	value]"

 is placed

<icon-l>

<icon-l>

inside

 of a button or link, the icon will be identified as an image or graphic, and the

aria-label

 a button or link, the image role is not announced.

, the element itself is treated as an image,

 applied. Encountered by screen reader

The	generator

Use this tool to generate basic

Icon

 CSS and HTML.

The code generator tool is only available
with comments.

in the accompanying site
↗

. Here is the basic solution,

HTML

We can employ the

<use>

 element
↗

 to embed the icon from a remote

icons.svg

 file.

<span	class="with-icon">
		<svg	class="icon">
				<use	href="/path/to/icons.svg#cross"></use>
		</svg>
		Close
</span>

CSS

The

with-icon

 class is only necessary if you wish to eliminate the natural word space and employ

margin

 instead.

.icon	{
		height:	0.75em;
		/*	↓	Override	the	em	value	with	`1cap`
		where	`cap`	is	supported	*/
		height:	1cap;
		width:	0.75em;
		width:	1cap;
}

.with-icon	{
		/*	↓	Set	the	`inline-flex`	context,
		which	eliminates	the	word	space	*/
		display:	inline-flex;
		align-items:	baseline;
}

.with-icon	.icon	{
		/*	↓	Use	the	logical	margin	property
		and	a	--space	variable	with	a	fallback	*/
		margin-inline-end:	var(--space,	0.5em);
}

As outlined in our blog post
the space value declaratively, on the element itself, using the

Dynamic CSS Components Without JavaScript
↗
 attribute:

style

, you can adjust

<span	class="with-icon">
		<svg	class="icon"	style="--space:	0.333em">
				<use	href="/images/icons/icons.svg#cross"></use>
		</svg>
		Close
</span>

The	component

A custom element implementation of the Icon is available for

download
↗
.

Props	API

The following props (attributes) will cause the
 component to re-render when altered. They
Icon
can be altered by hand—in browser developer tools—or as the subjects of inherited application
state.

Name

space

label

Type

string

string

Default

Description

null

null

The space between the text and
the icon. If null, natural word
spacing is preserved

Turns the element into an image
in assistive technologies and
adds an aria-label of the value

Examples

Button	with	icon	and	accompanying	text

In the following example, the
assumes the button’s accessible name, meaning the button will be announced as
button”
information.

 (or equivalent) in screen reader software. The SVG is ignored, since it provides no textual

 provides an icon and accompanying text to a button. The

“Close,

<icon-l>

In this case, an explicit space/margin of

0.5em

 has been set.

<button>
		<icon-l	space="0.5em">
				<svg>
						<use	href="/images/icons/icons.svg#cross"></use>
				</svg>
				Close
		</icon-l>
</button>

Button	with	just	an	icon

Where not accompanying text is provided, the button is in danger of not having an accessible
name. By providing a
 is communicated as a labeled image to screen
reader software (using

 prop, the
 and

). This is the authored code:

aria-label="[the	prop	value]"

role="img"

<icon-l>

label

<button>
		<icon-l	label="Close">
				<svg>
						<use	href="/path/to/icons.svg#cross"></use>
				</svg>
		</icon-l>
</button>

And this is the code after instantiation:

<button>
		<icon-l	space="0.5em"	label="Close"	role="img"	aria-label="Close">
				<svg>
						<use	href="/path/to/icons.svg#cross"></use>
				</svg>
		</icon-l>
</button>

The	Container

Something we are starting to get asked a lot is this:

Now
we
have
container
queries,
is
Every
Layout
obsolete?

Every
Layout

As the proprietors of
layout solution as possible. So it is with great relief when we say that
useful as they are, and we’ll get into that shortly) absolutely do not make
worm food, shark chum, or in any other way

, it’s in our interest to eke as much out of our peculiar CSS
 (as
 obsolete,

container queries
↗
Every
Layout

done
.

Every
Layout

 is an exposition of the benefit of automatic, self-governing layout. The

Primarily,
less manual intervention you have to do, the better. It’s less code and less bother. So far,
manual intervention has exclusively meant
Here’s a trivial example that switches a Flexbox layout between one and two columns:

“using
a
width-related

 of some sort.

query”

@media

.layout	{
		display:	flex;
		flex-wrap:	wrap;
}

.layout	>	*	{
		flex-basis:	50%;	/*	two	columns	*/
}

@media	(max-width:	360px)	{
		.layout	>	*	{
				flex-basis:	100%;	/*	one	column	*/
		}
}

Media queries are especially problematic because they pertain to the width of the viewport, not
the space actually available to the element/component/layout in question. Media queries are
only pertinent when your overarching page layout is not subject to change.

As the name suggests, container queries pertain to a containing element. It is this containing
element we measure, not the viewport, and it yields values much more useful for layout
purposes.

.layout	{
		display:	flex;
		flex-wrap:	wrap;
		container-type:	inline-size;
}

.layout	>	*	{
		flex-basis:	50%;	/*	two	columns	*/
}

@container	(width	<	360px)	{
		.layout	>	*	{
				flex-basis:	100%;	/*	one	column	*/
		}
}

@media

 and

@container

 queries are forms of manual intervention. They are circuit breakers we

Both
wire into layouts we know are going to error. And while I’m grateful for the existence of circuit
breakers (otherwise my house might have repeatedly caught on fire) I’d sooner not have them
anywhere I know they’re not needed.

What if we took this approach instead?

.layout	{
		display:	flex;
		flex-wrap:	wrap;
}

.layout	>	*	{
		flex-basis:	180px;	/*	half	of	360px	*/
		flex-grow:	1;
}

It’s less code. It’s more backwards compatible code. But more importantly, it’s code that
revolves around the subject elements, not the viewport or a container they may or may not
belong to. It’s an

 sound layout.

intrinsically

 is a layout that intrinsically switches between 1 and 2-column states.

Every
Layout’s Sidebar
And it bases where to switch on the comparative widths of the two elements (sidebar and non-
sidebar). Increasing the sidebar width reveals the elegance of this approach: the position of the
switch automatically moves.

This is not something container queries are capable of because they only know the container’s
state, not the state(s) of the elements inside it. Were you to increase the sidebar width, you
would have to manually adjust the container breakpoint or create a complex set of new rules:

.with-sidebar	{
		container-type:	inline-size;
}

@container	(width	<	640px)	{
		.with-sidebar:has(.sidebar--large)	>	*	{
				flex-basis:	100%;
		}
}

@container	(width	<	360px)	{
		.with-sidebar:has(.sidebar--small)	>	*	{
				flex-basis:	100%;
		}
}

The	:has()	functional	pseudo-class

:has()

I’m using the
the class
.sidebar--small
element aware of its children and is not necessary in the

 or with the class

 function
↗

.sidebar--large

. It’s the only way of making an
Sidebar

 layout component.

 to check whether the sidebar layout includes an element with

The	problem

So what layout problem (or problems) do container queries solve? The simple answer is:
which
an
intrinsically
sound
layout
cannot
be
easily
devised
layout generics we provide here—especially when used in
your layout challenges, it doesn’t hurt to have an escape hatch.

. And while we are confident the
composition

—will solve the majority of

any
for

The
Container
the
damn
owl”

 layout is not a layout as such. It’s more our way of saying
. Except, in this case, most of the owl is already done.

“now
draw
the
rest
of

The	solution

⚠		Not	really	a	layout

All we’re going to solve here is the establishment of containers. How you “query” these
containers is left up to you, for whenever you feel a need for them.

Using container queries allows you to finesse the other layouts in ways that would not
otherwise be possible. As such, this is not a layout solution; more a meta-layout utility.

In terms of establishing containers, there are two main things to be aware of:

1.  Containers can be named or unnamed
2.  Containers can be nested

Unnamed	containers

The simplest way to set up a container is using the
Layout

 would invariably be

-like layouts, the

type

.
inline-size

container-type

 property. For adapting

Every

.container	{
		container-type:	inline-size;
}

When nesting containers, any query will correspond, by default, to the closest ancestral

container:

<div	class="container">
		<div	class="container">
				<div	class="container">
						<div	class="container">	<!--	the	corresponding	container	-->
								<!--	querying	from	an	element	here	-->
						</div>
				</div>
		</div>
</div>

Named	containers

You can name a container using the following shorthand syntax, which combines the name with
the type:

.container	{
		container:	myContainer	/	inline-size;
}

Now you can query any container,

at
any
ancestral
level

, by referencing its name:

.layout	{
		container:	myContainer	/	inline-size;
}

@container	myContainer	(width	<	360px)	{
		.layout	>	*	{
				/*	fill	your	boots	*/
		}
}

Use	cases

You can use container queries to affect
Container queries are just hooks, you have all of CSS at your disposal.

 styles contingent on container dimensions.

any

So the question becomes: which CSS properties are
The size and wrapping behavior of your typography could certainly be applicable, for example,
and there are

container units (video introduction)
↗

 to changing container dimensions?

 to help with that.

relevant

On the other hand, you probably
the use in that? It’s not relevant to layout.

don’t

 want to change the

color

 or

font-family

. What would be

Tutorials explaining CSS selectors always seem to use a change in
selector being applied but it’s usually the last thing you want to change—especially between the
typically unimaginative

 to demonstrate the

, and  …

,
green blue

color

red

The	generator

Use this tool to generate basic

Container

 CSS and HTML.

The code generator tool is only available in
basic solution, with comments:

the accompanying documentation site
↗

. Here is the

CSS

.container	{
		/*	↓	Your	name	for	the	container	*/
		container-name:	myContainer;
		/*	↓	The	type	of	containment	context	*/
		container-type:	inline-size;
}

HTML

<div	class="container"></div>

The	component

A custom element implementation of the Container is available for

download
↗
.

Props	API

The following props (attributes) will cause the
They can be altered by hand—in browser developer tools—or as the subjects of inherited
application state.

 component to re-render when altered.

Container

Name

name

Type

string

Description

The name of the container, used as the CSS
 value (optional)

container-name

Examples

Unnamed	container

<container-l></container-l>

Named	container

<container-l	name="myContainer"></container-l>


