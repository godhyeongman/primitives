import * as React from 'react';
import { createContextScope } from '@radix-ui/react-context';
import { useCallbackRef } from '@radix-ui/react-use-callback-ref';
import { useLayoutEffect } from '@radix-ui/react-use-layout-effect';
import { Primitive } from '@radix-ui/react-primitive';

import type * as Radix from '@radix-ui/react-primitive';
import type { Scope } from '@radix-ui/react-context';

/* -------------------------------------------------------------------------------------------------
 * Avatar
 * -----------------------------------------------------------------------------------------------*/

const AVATAR_NAME = 'Avatar';

type ScopedProps<P> = P & { __scopeAvatar?: Scope };
const [createAvatarContext, createAvatarScope] = createContextScope(AVATAR_NAME);

type ImageLoadingStatus = 'idle' | 'loading' | 'loaded' | 'error';

type AvatarContextValue = {
  imageLoadingStatus: ImageLoadingStatus;
  onImageLoadingStatusChange(status: ImageLoadingStatus): void;
};

const [AvatarProvider, useAvatarContext] = createAvatarContext<AvatarContextValue>(AVATAR_NAME);

type AvatarElement = React.ElementRef<typeof Primitive.span>;
type PrimitiveSpanProps = Radix.ComponentPropsWithoutRef<typeof Primitive.span>;
interface AvatarProps extends PrimitiveSpanProps {}

const Avatar = React.forwardRef<AvatarElement, AvatarProps>(
  (props: ScopedProps<AvatarProps>, forwardedRef) => {
    // __scopeAvatar는 옵션, 컨텍스트 스코핑을 하고싶으면 사용하는듯
    const { __scopeAvatar, ...avatarProps } = props;
    // 로딩 상태
    const [imageLoadingStatus, setImageLoadingStatus] = React.useState<ImageLoadingStatus>('idle');
    return (
      <AvatarProvider
        scope={__scopeAvatar}
        imageLoadingStatus={imageLoadingStatus}
        onImageLoadingStatusChange={setImageLoadingStatus}
      >
        <Primitive.span {...avatarProps} ref={forwardedRef} />
      </AvatarProvider>
    );
  }
);

Avatar.displayName = AVATAR_NAME;

/* -------------------------------------------------------------------------------------------------
 * AvatarImage
 * -----------------------------------------------------------------------------------------------*/

const IMAGE_NAME = 'AvatarImage';

type AvatarImageElement = React.ElementRef<typeof Primitive.img>;
type PrimitiveImageProps = Radix.ComponentPropsWithoutRef<typeof Primitive.img>;
interface AvatarImageProps extends PrimitiveImageProps {
  onLoadingStatusChange?: (status: ImageLoadingStatus) => void;
}

/**
 * 아바타 Context에서 이미지 로딩상태를 읽고 로딩이 완료된 상태에만 이미지를 나타냄
 * 그전에는 아바타를 DOM에 나타내지 않음
 * 뭔가 아쉽다고 생각되는건 이미지의 로딩상태의 이미지나 에러 이미지를 표현하지 않는것 같은데 이 처리가 있으면 좋지 않을까 생각이 듬
 * */
const AvatarImage = React.forwardRef<AvatarImageElement, AvatarImageProps>(
  (props: ScopedProps<AvatarImageProps>, forwardedRef) => {
    const { __scopeAvatar, src, onLoadingStatusChange = () => {}, ...imageProps } = props;
    const context = useAvatarContext(IMAGE_NAME, __scopeAvatar);
    // 가짜 Image element를 만들고 해당 element의 이미지 로딩 여부를 확인하는 훅, 의문점은 왜 ref로 진짜 img를 넣어서 로딩상태를 읽지 않는가?
    // 예상해 봤을때 브라우저가 동일한 url의 자원을 요청했을때 동일한 요청을 안해서 이지 않을까??
    // 확인 결과 브라우저에서 동일한 URL로 image 리소스를 요청하였을때 중복적으로 호출하지 않음 첫번째 요청을 재사용함 그래서 까자 img 요소를 생성해서 요청하고 상태를 사용하는듯
    const imageLoadingStatus = useImageLoadingStatus(src);
    // useCallbackRef를 통해 비동기적으로도 로딩상태 최신화가 가능해짐 + 콜백 함수 자체가 재생성 되지 않음
    const handleLoadingStatusChange = useCallbackRef((status: ImageLoadingStatus) => {
      onLoadingStatusChange(status);
      context.onImageLoadingStatusChange(status);
    });

    useLayoutEffect(() => {
      if (imageLoadingStatus !== 'idle') {
        handleLoadingStatusChange(imageLoadingStatus);
      }
    }, [imageLoadingStatus, handleLoadingStatusChange]);

    // 이부분은 context.imageLoadingStatus가 더 올바르지 않을까?
    return imageLoadingStatus === 'loaded' ? (
      <Primitive.img {...imageProps} ref={forwardedRef} src={src} />
    ) : null;
  }
);

AvatarImage.displayName = IMAGE_NAME;

/* -------------------------------------------------------------------------------------------------
 * AvatarFallback
 * -----------------------------------------------------------------------------------------------*/

const FALLBACK_NAME = 'AvatarFallback';

type AvatarFallbackElement = React.ElementRef<typeof Primitive.span>;
interface AvatarFallbackProps extends PrimitiveSpanProps {
  delayMs?: number;
}

/**
 * AvatarContext 에서 로딩 상태를 도출하고
 * 로딩 상태가 아니라면 span을 보여줌
 *
 * 아쉽다 생각된점 childrendㅡㄹ 사용할수 없는 이유가 궁금함 단순 텍스트 말고 children을 통해서 로딩이 안된 상태에 이미지라든가 다른 ui를 노출하고 싶다면?
 * */
const AvatarFallback = React.forwardRef<AvatarFallbackElement, AvatarFallbackProps>(
  (props: ScopedProps<AvatarFallbackProps>, forwardedRef) => {
    const { __scopeAvatar, delayMs, ...fallbackProps } = props;
    const context = useAvatarContext(FALLBACK_NAME, __scopeAvatar);
    const [canRender, setCanRender] = React.useState(delayMs === undefined);

    // 바로 Fallback을 보여주면 에러 상황이 아니라 진짜 단순 로딩 상태에서도 깜빡임이 있으니 일정시간 대기를 두기위해서 delayMS를 사용하는 듯
    React.useEffect(() => {
      if (delayMs !== undefined) {
        const timerId = window.setTimeout(() => setCanRender(true), delayMs);
        return () => window.clearTimeout(timerId);
      }
    }, [delayMs]);

    return canRender && context.imageLoadingStatus !== 'loaded' ? (
      <Primitive.span {...fallbackProps} ref={forwardedRef} />
    ) : null;
  }
);

AvatarFallback.displayName = FALLBACK_NAME;

/* -----------------------------------------------------------------------------------------------*/

/**
 * 브라우저에서 동일한 URL로 image 리소스 요청시 한번만 이미지가 요청되는걸 이용한 훅
 * 가상의 img 요소를 생성하고 이를 통해서 먼저 img 요소를 전달받음 이를 통해서 img 리소스 요청의 상태를 도출하고 상태로 사용가능함
 * */
function useImageLoadingStatus(src?: string) {
  const [loadingStatus, setLoadingStatus] = React.useState<ImageLoadingStatus>('idle');

  useLayoutEffect(() => {
    if (!src) {
      setLoadingStatus('error');
      return;
    }

    let isMounted = true;
    const image = new window.Image();

    // 컴포넌트 unMount시 상태를 바꾸지 않도록 하는 동작
    const updateStatus = (status: ImageLoadingStatus) => () => {
      if (!isMounted) return;
      setLoadingStatus(status);
    };

    setLoadingStatus('loading');
    image.onload = updateStatus('loaded');
    image.onerror = updateStatus('error');
    image.src = src;

    return () => {
      isMounted = false;
    };
  }, [src]);

  return loadingStatus;
}
const Root = Avatar;
const Image = AvatarImage;
const Fallback = AvatarFallback;

export {
  createAvatarScope,
  //
  Avatar,
  AvatarImage,
  AvatarFallback,
  //
  Root,
  Image,
  Fallback,
};
export type { AvatarProps, AvatarImageProps, AvatarFallbackProps };
