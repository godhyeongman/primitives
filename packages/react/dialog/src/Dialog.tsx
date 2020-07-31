import * as React from 'react';
import { Portal } from '@interop-ui/react-portal';
import { Lock, useLockContext } from '@interop-ui/react-lock';
import { cssReset, interopDataAttrObj } from '@interop-ui/utils';
import { RemoveScroll } from 'react-remove-scroll';
import {
  createContext,
  forwardRef,
  useCallbackRef,
  useComposedRefs,
  PrimitiveStyles,
} from '@interop-ui/react-utils';
import { useDebugContext } from '@interop-ui/react-debug-context';

/* -------------------------------------------------------------------------------------------------
 * Root level context
 * -----------------------------------------------------------------------------------------------*/

type DialogContextValue = {
  isOpen: DialogRootProps['isOpen'];
  onClose: NonNullable<DialogRootProps['onClose']>;
  refToFocusOnOpen: DialogRootProps['refToFocusOnOpen'];
  refToFocusOnClose: DialogRootProps['refToFocusOnClose'];
  shouldCloseOnEscape: DialogRootProps['shouldCloseOnEscape'];
  shouldCloseOnOutsideClick: DialogRootProps['shouldCloseOnOutsideClick'];
};

const [DialogContext, useDialogContext] = createContext<DialogContextValue>(
  'DialogContext',
  'Dialog.Root'
);

/* -------------------------------------------------------------------------------------------------
 * DialogRoot
 * -----------------------------------------------------------------------------------------------*/

type DialogRootProps = {
  /** whether the Dialog is currently opened or not */
  isOpen: boolean;

  /** A function called when the Dialog is closed from the inside (escape / outslide click) */
  onClose?(): void;

  /**
   * A ref to an element to focus on inside the Dialog after it is opened.
   * (default: first focusable element inside the Dialog)
   * (fallback: first focusable element inside the Dialog, then the Dialog's content container)
   */
  refToFocusOnOpen?: React.RefObject<HTMLElement | null | undefined>;

  /**
   * A ref to an element to focus on outside the Dialog after it is closed.
   * (default: last focused element before the Dialog was opened)
   * (fallback: none)
   */
  refToFocusOnClose?: React.RefObject<HTMLElement | null | undefined>;

  /**
   * Whether pressing the `Escape` key should close the Dialog
   * (default: `true`)
   */
  shouldCloseOnEscape?: boolean;

  /**
   * Whether clicking outside the Dialog should close it
   * (default: `true`)
   */
  shouldCloseOnOutsideClick?: boolean | ((event: MouseEvent | TouchEvent) => boolean);
};

const DialogRoot: React.FC<DialogRootProps> = (props) => {
  const {
    children,
    isOpen,
    onClose: onCloseProp,
    refToFocusOnClose,
    refToFocusOnOpen,
    shouldCloseOnEscape,
    shouldCloseOnOutsideClick,
  } = props;

  const onClose: () => void = useCallbackRef(() => {
    onCloseProp && onCloseProp();
  });

  const ctx = React.useMemo(
    () => ({
      isOpen,
      onClose,
      refToFocusOnClose,
      refToFocusOnOpen,
      shouldCloseOnEscape,
      shouldCloseOnOutsideClick,
    }),
    [
      isOpen,
      onClose,
      refToFocusOnClose,
      refToFocusOnOpen,
      shouldCloseOnEscape,
      shouldCloseOnOutsideClick,
    ]
  );

  return (
    <DialogContext.Provider value={ctx}>
      <Portal {...interopDataAttrObj('DialogRoot')}>{children}</Portal>
    </DialogContext.Provider>
  );
};

DialogRoot.displayName = 'Dialog.Root';

/* -------------------------------------------------------------------------------------------------
 * DialogOverlay
 * -----------------------------------------------------------------------------------------------*/

const OVERLAY_DEFAULT_TAG = 'div';

type DialogOverlayDOMProps = React.ComponentPropsWithoutRef<typeof OVERLAY_DEFAULT_TAG>;
type DialogOverlayOwnProps = {};
type DialogOverlayProps = DialogOverlayDOMProps & DialogOverlayOwnProps;

const DialogOverlay = forwardRef<typeof OVERLAY_DEFAULT_TAG, DialogOverlayProps>(
  function DialogOverlay(props, forwardedRef) {
    let debugContext = useDebugContext();
    let { as: Comp = OVERLAY_DEFAULT_TAG, style, ...overlayProps } = props;
    return (
      <Comp
        {...interopDataAttrObj('DialogRoot')}
        ref={forwardedRef}
        style={{ pointerEvents: debugContext.disableLock ? 'none' : undefined, ...style }}
        {...overlayProps}
      />
    );
  }
);

DialogOverlay.displayName = 'Dialog.Overlay';

/* -------------------------------------------------------------------------------------------------
 * DialogInner
 * -----------------------------------------------------------------------------------------------*/

const INNER_DEFAULT_TAG = 'div';

type DialogInnerDOMProps = React.ComponentPropsWithoutRef<typeof INNER_DEFAULT_TAG>;
type DialogInnerOwnProps = {};
type DialogInnerProps = DialogInnerDOMProps & DialogInnerOwnProps;

const DialogInner = forwardRef<typeof INNER_DEFAULT_TAG, DialogInnerProps>(function DialogInner(
  props,
  forwardedRef
) {
  let { as: Comp = INNER_DEFAULT_TAG, children, ...innerProps } = props;
  const debugContext = useDebugContext();
  let {
    isOpen,
    onClose,
    refToFocusOnOpen,
    refToFocusOnClose,
    shouldCloseOnEscape,
    shouldCloseOnOutsideClick,
  } = useDialogContext('Dialog.Inner');
  return (
    <Comp {...interopDataAttrObj('DialogInner')} ref={forwardedRef} {...innerProps}>
      <RemoveScroll>
        <Lock
          isActive={debugContext.disableLock ? false : isOpen}
          onDeactivate={onClose}
          refToFocusOnActivation={refToFocusOnOpen}
          refToFocusOnDeactivation={refToFocusOnClose}
          shouldDeactivateOnEscape={shouldCloseOnEscape}
          shouldDeactivateOnOutsideClick={shouldCloseOnOutsideClick}
          shouldBlockOutsideClick
        >
          {children}
        </Lock>
      </RemoveScroll>
    </Comp>
  );
});

DialogInner.displayName = 'Dialog.Inner';

/* -------------------------------------------------------------------------------------------------
 * DialogContent
 * -----------------------------------------------------------------------------------------------*/

const CONTENT_DEFAULT_TAG = 'div';

type DialogContentDOMProps = React.ComponentPropsWithoutRef<typeof CONTENT_DEFAULT_TAG>;
type DialogContentOwnProps = {};
type DialogContentProps = DialogContentDOMProps & DialogContentOwnProps;

const DialogContent = forwardRef<typeof CONTENT_DEFAULT_TAG, DialogContentProps>(
  function DialogContent(props, forwardedRef) {
    let { as: Comp = CONTENT_DEFAULT_TAG, children, ...contentProps } = props;
    let { lockContainerRef } = useLockContext();
    return (
      <Comp
        {...interopDataAttrObj('DialogContent')}
        ref={useComposedRefs(forwardedRef, lockContainerRef)}
        role="dialog"
        aria-modal
        {...contentProps}
      >
        {children}
      </Comp>
    );
  }
);

DialogContent.displayName = 'Dialog.Content';

/* -------------------------------------------------------------------------------------------------
 * Composed Dialog
 * -----------------------------------------------------------------------------------------------*/

type DialogDOMProps = React.ComponentPropsWithoutRef<typeof CONTENT_DEFAULT_TAG>;
type DialogOwnProps = DialogRootProps;
type DialogProps = DialogDOMProps & DialogOwnProps;

const Dialog = forwardRef<typeof CONTENT_DEFAULT_TAG, DialogProps, DialogStaticProps>(
  function Dialog(props, forwardedRef) {
    let {
      isOpen,
      onClose,
      refToFocusOnOpen,
      refToFocusOnClose,
      shouldCloseOnEscape,
      shouldCloseOnOutsideClick,
      children,
      ...contentProps
    } = props;
    return (
      <DialogRoot
        isOpen={isOpen}
        onClose={onClose}
        refToFocusOnOpen={refToFocusOnOpen}
        refToFocusOnClose={refToFocusOnClose}
        shouldCloseOnEscape={shouldCloseOnEscape}
        shouldCloseOnOutsideClick={shouldCloseOnOutsideClick}
      >
        <DialogOverlay>
          <DialogInner>
            <DialogContent ref={forwardedRef} {...contentProps}>
              {children}
            </DialogContent>
          </DialogInner>
        </DialogOverlay>
      </DialogRoot>
    );
  }
);

Dialog.displayName = 'Dialog';
Dialog.Root = DialogRoot;
Dialog.Overlay = DialogOverlay;
Dialog.Inner = DialogInner;
Dialog.Content = DialogContent;

interface DialogStaticProps {
  Root: typeof DialogRoot;
  Overlay: typeof DialogOverlay;
  Inner: typeof DialogInner;
  Content: typeof DialogContent;
}

const styles: PrimitiveStyles = {
  root: null,
  overlay: {
    ...cssReset(OVERLAY_DEFAULT_TAG),
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  inner: {
    ...cssReset(INNER_DEFAULT_TAG),
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
  },
  content: {
    ...cssReset(CONTENT_DEFAULT_TAG),
    pointerEvents: 'auto',
  },
};

export { Dialog, styles };
export type {
  DialogProps,
  DialogRootProps,
  DialogOverlayProps,
  DialogContentProps,
  DialogInnerProps,
};