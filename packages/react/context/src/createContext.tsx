import * as React from 'react';

function createContext<ContextValueType extends object | null>(
  rootComponentName: string,
  defaultContext?: ContextValueType
) {
  const Context = React.createContext<ContextValueType | undefined>(defaultContext);

  function Provider(props: ContextValueType & { children: React.ReactNode }) {
    const { children, ...context } = props;
    // Only re-memoize when prop values change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const value = React.useMemo(() => context, Object.values(context)) as ContextValueType;
    return <Context.Provider value={value}>{children}</Context.Provider>;
  }

  function useContext(consumerName: string) {
    const context = React.useContext(Context);
    if (context) return context;
    if (defaultContext !== undefined) return defaultContext;
    // if a defaultContext wasn't specified, it's a required context.
    throw new Error(`\`${consumerName}\` must be used within \`${rootComponentName}\``);
  }

  Provider.displayName = rootComponentName + 'Provider';
  return [Provider, useContext] as const;
}

/* -------------------------------------------------------------------------------------------------
 * createContextScope
 * -----------------------------------------------------------------------------------------------*/

/**
 * 컨텍스트 저장 된 객체 스코프 이름을 통해서 해당 컨텍스트 참조 가능
 * */
type Scope<C = any> = { [scopeName: string]: React.Context<C>[] } | undefined;
type ScopeHook = (scope: Scope) => { [__scopeProp: string]: Scope };
interface CreateScope {
  scopeName: string;
  (): ScopeHook; //이게 뭘까?
}

/**
 * @param scopeName 개발자 도구용 에서 컨텍스트 확인하기 쉬우려고 사용하는듯
 * @param createContextScopeDeps 이 객체 안에 또 scopeName이 있음
 * */
function createContextScope(scopeName: string, createContextScopeDeps: CreateScope[] = []) {
  let defaultContexts: any[] = [];

  /* -----------------------------------------------------------------------------------------------
   * createContext
   * scope가 적용된 컨텍스트 생성
   * return -> Provider, useContext
   * ---------------------------------------------------------------------------------------------*/

  function createContext<ContextValueType extends object | null>(
    rootComponentName: string,
    defaultContext?: ContextValueType
  ) {
    // prpos로 받은 defaultContext를 통해서  기본 컨텍스트 생성 배열도 가능한듯
    const BaseContext = React.createContext<ContextValueType | undefined>(defaultContext);
    // 기존 기본 컨텍스트(배열)모음 의 길이
    const index = defaultContexts.length;
    // 기존 기본 컨텍스트에 props로 받은 컨텍스트 추가
    defaultContexts = [...defaultContexts, defaultContext];

    function Provider(
      props: ContextValueType & { scope: Scope<ContextValueType>; children: React.ReactNode }
    ) {
      // scope -> context 보관 객체,
      const { scope, children, ...context } = props;
      // context 보관 객체에 scopeName 객체가 있다면 해당 context 아니라면 기본 context
      const Context = scope?.[scopeName][index] || BaseContext;
      // Only re-memoize when prop values change -> [최적화] 프롭스 값 변경 될경우 다시 프롭스값 리 메모
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const value = React.useMemo(() => context, Object.values(context)) as ContextValueType;
      // scope 객체에서 받아온 컨텍스트의 프로바이더 반환
      return <Context.Provider value={value}>{children}</Context.Provider>;
    }

    /**
     * @param consumerName 필수 에러 메세지 반환용 컨슈머 이름 사용됨
     * @param scope context 보관 객체(key -> contextName)
     * */
    function useContext(consumerName: string, scope: Scope<ContextValueType | undefined>) {
      const Context = scope?.[scopeName][index] || BaseContext;
      const context = React.useContext(Context);
      // 만약 useContext로 Scope context 혹은 BaseContext 사용 가능하면 해당 context 반환
      if (context) return context;
      // useContext 사용 불가능하고  defaultContext 가 있다면 defaultContext 반환
      if (defaultContext !== undefined) return defaultContext;
      // if a defaultContext wasn't specified, it's a required context. -> 기본 컨텍스트 마저 없는 상황이라면 필수한 context가 제공 안되었음을 알림
      throw new Error(`\`${consumerName}\` must be used within \`${rootComponentName}\``);
    }

    Provider.displayName = rootComponentName + 'Provider';
    // 스코프 객체안에 context가 있다면 해당 context의 프로바이더와 훅을 아니라면 기본 context의 프로바이더와 훅을 반환
    return [Provider, useContext] as const;
  }

  /* -----------------------------------------------------------------------------------------------
   * createScope
   * ---------------------------------------------------------------------------------------------*/

  const createScope: CreateScope = () => {
    // 컨텍스트 배열을 순회하며 context 생성
    const scopeContexts = defaultContexts.map((defaultContext) => {
      return React.createContext(defaultContext);
    });

    /**
     * scope객체를 useScope를 통해서만 사용하기위한 용도인듯 반환 하는 scope객체는 키값이 __scope 형태를 취함 기존 context는 __scope의 프로퍼티로 이동됨
     * @param scope context 저장객체
     * */
    return function useScope(scope: Scope) {
      const contexts = scope?.[scopeName] || scopeContexts;

      // 이 부분이 중요한듯?
      // 최적화를 위해서 scope 인자나 scope에 없을 경우 생긴 scopeContext가 변동되었을 경우만 반환하는 scope객체 변경
      return React.useMemo(
        () => ({ [`__scope${scopeName}`]: { ...scope, [scopeName]: contexts } }),
        [scope, contexts]
      );
    };
  };

  createScope.scopeName = scopeName;
  // 스코프에서 컨텍스트 꺼내는 createContext
  // composeContextScopes ??
  return [createContext, composeContextScopes(createScope, ...createContextScopeDeps)] as const;
}

/* -------------------------------------------------------------------------------------------------
 * composeContextScopes
 * -----------------------------------------------------------------------------------------------*/

function composeContextScopes(...scopes: CreateScope[]) {
  const baseScope = scopes[0];
  if (scopes.length === 1) return baseScope;

  const createScope: CreateScope = () => {
    const scopeHooks = scopes.map((createScope) => ({
      useScope: createScope(),
      scopeName: createScope.scopeName,
    }));

    return function useComposedScopes(overrideScopes) {
      const nextScopes = scopeHooks.reduce((nextScopes, { useScope, scopeName }) => {
        // We are calling a hook inside a callback which React warns against to avoid inconsistent
        // renders, however, scoping doesn't have render side effects so we ignore the rule.
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const scopeProps = useScope(overrideScopes);
        const currentScope = scopeProps[`__scope${scopeName}`];
        return { ...nextScopes, ...currentScope };
      }, {});

      return React.useMemo(() => ({ [`__scope${baseScope.scopeName}`]: nextScopes }), [nextScopes]);
    };
  };

  createScope.scopeName = baseScope.scopeName;
  return createScope;
}

/* -----------------------------------------------------------------------------------------------*/

export { createContext, createContextScope };
export type { CreateScope, Scope };
