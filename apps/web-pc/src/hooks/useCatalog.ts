import { useState, useRef, useCallback } from "react";
import { api } from "../api";
import { 
  BannerItem, 
  CategoryTag, 
  CategoryType, 
  RankItem, 
  RankTypeItem, 
  Section, 
  Series 
} from "../types";

export function useCatalog(showToast: (msg: string) => void) {
  // 首页状态
  const [selectedHomeSection, setSelectedHomeSection] = useState<string>("all");
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);

  // 分类状态
  const [categoryTypes, setCategoryTypes] = useState<CategoryType[]>([]);
  const [selectedCatType, setSelectedCatType] = useState<string>("real-drama");
  const [categoryTags, setCategoryTags] = useState<CategoryTag[]>([]);
  const [categoryTagsLoading, setCategoryTagsLoading] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [selectedCatTag, setSelectedCatTag] = useState<string>("");
  const [categoryItems, setCategoryItems] = useState<Series[]>([]);
  const [categoryTotalPages, setCategoryTotalPages] = useState<number>(0);
  const [catPage, setCatPage] = useState(1);
  const [catLoading, setCatLoading] = useState(false);

  // 官方榜单状态
  const [rankTypes, setRankTypes] = useState<RankTypeItem[]>([]);
  const [selectedRankSlug, setSelectedRankSlug] = useState<string>("hot-real-drama");
  const [rankItems, setRankItems] = useState<RankItem[]>([]);
  const [rankLoading, setRankLoading] = useState(false);
  const [rankPage, setRankPage] = useState(1);
  const [rankTotalPages, setRankTotalPages] = useState(5);

  // 单例防重复请求控制器 (保持 D3-F2 修复)
  const homeDataLoadedRef = useRef(false);
  const homeDataInFlightRef = useRef<Promise<any> | null>(null);
  const rankTypesLoadedRef = useRef(false);
  const categoryTagsLoadedRef = useRef<Record<string, boolean>>({});
  const categoryTagsInFlightRef = useRef<Map<string, Promise<any>>>(new Map());
  const categoryTagsRequest = useRef(0);
  const categoryListRequest = useRef(0);

  // 加载首页基础数据
  const loadHomeData = useCallback(async () => {
    if (homeDataLoadedRef.current) return;
    if (homeDataInFlightRef.current) return homeDataInFlightRef.current;
    try {
      setLoading(true);
      const promise = Promise.all([
        api.getBanners(),
        api.getSections(),
      ]);
      homeDataInFlightRef.current = promise;
      const [bannerData, sectionData] = await promise;
      homeDataLoadedRef.current = true;
      setBanners(bannerData);
      setSections(sectionData);
    } catch {
      showToast("获取首页数据失败，请确认服务端已启动");
    } finally {
      homeDataInFlightRef.current = null;
      setLoading(false);
    }
  }, [showToast]);

  // 加载分类标签
  const loadCategoryTags = useCallback(async (type = "real-drama") => {
    if (categoryTagsLoadedRef.current[type]) return;
    if (categoryTagsInFlightRef.current.has(type)) {
      return categoryTagsInFlightRef.current.get(type);
    }
    const request = ++categoryTagsRequest.current;
    setCategoryTagsLoading(true);
    setCategoryTags([]);
    const promise = (async () => {
      try {
        const res = await api.getCategoryTags(type);
        if (request !== categoryTagsRequest.current) return;
        categoryTagsLoadedRef.current[type] = true;
        if (res.types && res.types.length > 0) setCategoryTypes(res.types);
        setCategoryTags(res.tags || []);
      } catch {
        if (request === categoryTagsRequest.current) {
          setCategoryError("官网题材读取失败，请重试");
        }
      } finally {
        categoryTagsInFlightRef.current.delete(type);
        if (request === categoryTagsRequest.current) {
          setCategoryTagsLoading(false);
        }
      }
    })();
    categoryTagsInFlightRef.current.set(type, promise);
    return promise;
  }, []);

  // 加载榜单类别定义
  const loadRankTypes = useCallback(async () => {
    if (rankTypesLoadedRef.current) return;
    rankTypesLoadedRef.current = true;
    try {
      const types = await api.getRankTypes();
      if (types && types.length > 0) setRankTypes(types);
    } catch {
      rankTypesLoadedRef.current = false;
      console.warn("加载榜单分类失败");
    }
  }, []);

  // 请求分类短剧列表
  const fetchCategoryList = useCallback(async (type: string, tag: string, page: number) => {
    const request = ++categoryListRequest.current;
    try {
      setCatLoading(true);
      setCategoryError("");
      setCategoryItems([]);
      const res = await api.getCategoryList(type, tag, page);
      if (request !== categoryListRequest.current) return;
      setCategoryItems(res.items || []);
      setCategoryTotalPages(res.pagination?.totalPages || 0);
    } catch {
      if (request === categoryListRequest.current) {
        setCategoryError("官网分类读取失败，请重试");
      }
    } finally {
      if (request === categoryListRequest.current) {
        setCatLoading(false);
      }
    }
  }, []);

  // 请求排行榜单分页列表 (1~5页，每页20部)
  const fetchRankList = useCallback(async (slug: string, page: number) => {
    try {
      setRankLoading(true);
      const res = await api.getRankPageList(slug, page);
      setRankItems(res.items || []);
      setRankTotalPages(res.totalPages || 5);
    } catch {
      showToast("加载榜单列表失败");
    } finally {
      setRankLoading(false);
    }
  }, [showToast]);

  return {
    // 首页
    selectedHomeSection,
    setSelectedHomeSection,
    banners,
    activeBannerIndex,
    setActiveBannerIndex,
    sections,
    loading,
    loadHomeData,
    // 分类
    categoryTypes,
    selectedCatType,
    setSelectedCatType,
    categoryTags,
    categoryTagsLoading,
    categoryError,
    selectedCatTag,
    setSelectedCatTag,
    categoryItems,
    categoryTotalPages,
    catPage,
    setCatPage,
    catLoading,
    loadCategoryTags,
    fetchCategoryList,
    // 榜单
    rankTypes,
    selectedRankSlug,
    setSelectedRankSlug,
    rankItems,
    rankLoading,
    rankPage,
    setRankPage,
    rankTotalPages,
    loadRankTypes,
    fetchRankList,
  };
}
