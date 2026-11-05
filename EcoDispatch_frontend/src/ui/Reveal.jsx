import {motion} from 'framer-motion';

const easeOut = [0.22, 1, 0.36, 1];

const defaultViewport = {once: true, amount: 0.18, margin: '0px 0px -8% 0px'};

const fadeUp = {
    hidden: {opacity: 0, y: 40},
    visible: {
        opacity: 1,
        y: 0,
        transition: {duration: 0.6, ease: easeOut}
    }
};

const staggerContainer = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.15,
            delayChildren: 0.05
        }
    }
};

const motionTags = {
    div: motion.div,
    section: motion.section,
    article: motion.article
};

/**
 * Fade-in + slide-up when scrolled into view. Use for section wrappers.
 */
export function Reveal({
    children,
    className = '',
    as = 'div',
    delay = 0,
    ...rest
}) {
    const MotionTag = motionTags[as] || motion.div;

    return (
        <MotionTag
            className={className}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={defaultViewport}
            custom={delay}
            transition={{duration: 0.6, ease: easeOut, delay}}
            {...rest}
        >
            {children}
        </MotionTag>
    );
}

/**
 * Parent for staggered metric / card grids.
 */
export function RevealStagger({children, className = '', as = 'div', ...rest}) {
    const MotionTag = motionTags[as] || motion.div;

    return (
        <MotionTag
            className={className}
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={defaultViewport}
            {...rest}
        >
            {children}
        </MotionTag>
    );
}

/**
 * Child item inside RevealStagger.
 */
export function RevealItem({children, className = '', as = 'div', ...rest}) {
    const MotionTag = motionTags[as] || motion.div;

    return (
        <MotionTag className={className} variants={fadeUp} {...rest}>
            {children}
        </MotionTag>
    );
}

export default Reveal;
