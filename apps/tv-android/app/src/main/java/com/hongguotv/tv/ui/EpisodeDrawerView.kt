package com.hongguotv.tv.ui

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.Button
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView
import com.hongguotv.tv.Detail
import com.hongguotv.tv.R
import com.hongguotv.tv.TvUi

internal class EpisodeDrawerView(
    context: Context,
    private val onDetailClick: () -> Unit,
    private val onEpisodeSelected: (Int) -> Unit
) : LinearLayout(context) {

    val titleView: TextView
    val groupTabsRow: LinearLayout
    val scrollView: HorizontalScrollView
    val episodeListRow: LinearLayout
    val drawerButtons = mutableListOf<Button>()

    var activeIndex: Int = 0
    var drawerEpisodeGroup: Int = 0

    private var pendingTabFocusIndex: Int? = null

    init {
        orientation = VERTICAL
        visibility = View.GONE
        background = TvUi.surface(0xf20b0f19.toInt(), 0x33ffffff.toInt(), radius = 24f, strokeWidth = 2)
        setPadding(
            TvUi.dimen(context, R.dimen.episode_drawer_pad_h),
            TvUi.dimen(context, R.dimen.episode_drawer_pad_v),
            TvUi.dimen(context, R.dimen.episode_drawer_pad_h),
            TvUi.dimen(context, R.dimen.episode_drawer_pad_v)
        )
        isFocusable = false

        // 1. Top row: Title + Group Tabs + Full Detail Button
        val topRow = TvUi.row(context)
        titleView = TextView(context).apply {
            text = "选集列表"
            textSize = 15.5f
            setTextColor(Color.WHITE)
            setTypeface(typeface, Typeface.BOLD)
        }
        topRow.addView(titleView, LayoutParams(-2, -2).apply {
            marginEnd = TvUi.dimen(context, R.dimen.episode_drawer_title_margin_end)
        })

        groupTabsRow = TvUi.row(context)
        groupTabsRow.setOnHierarchyChangeListener(object : ViewGroup.OnHierarchyChangeListener {
            override fun onChildViewAdded(parent: View?, child: View?) {
                if (child is Button) {
                    child.setOnKeyListener { v, keyCode, event ->
                        if ((keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER)
                            && event.action == KeyEvent.ACTION_DOWN) {
                            val idx = groupTabsRow.indexOfChild(v)
                            if (idx >= 0) {
                                pendingTabFocusIndex = idx
                            }
                        }
                        false
                    }
                    child.setOnTouchListener { v, event ->
                        if (event.action == MotionEvent.ACTION_UP) {
                            val idx = groupTabsRow.indexOfChild(v)
                            if (idx >= 0) {
                                pendingTabFocusIndex = idx
                            }
                        }
                        false
                    }
                    child.accessibilityDelegate = object : View.AccessibilityDelegate() {
                        override fun performAccessibilityAction(host: View, action: Int, args: Bundle?): Boolean {
                            if (action == AccessibilityNodeInfo.ACTION_CLICK) {
                                val idx = groupTabsRow.indexOfChild(host)
                                if (idx >= 0) {
                                    pendingTabFocusIndex = idx
                                }
                            }
                            return super.performAccessibilityAction(host, action, args)
                        }
                    }
                }
            }
            override fun onChildViewRemoved(parent: View?, child: View?) {}
        })
        topRow.addView(groupTabsRow, LayoutParams(0, -2, 1f))

        val fullDetailBtn = Button(context).apply {
            text = "查看详情 >"
            textSize = 12.5f
            isAllCaps = false
            setTextColor(TvUi.TEXT_MUTED)
            background = TvUi.pillBackground(active = false, radius = 20f)
            minHeight = TvUi.dimen(context, R.dimen.episode_drawer_detail_btn_min_height)
            setPadding(
                TvUi.dimen(context, R.dimen.episode_drawer_detail_btn_pad_h),
                TvUi.dimen(context, R.dimen.episode_drawer_detail_btn_pad_v),
                TvUi.dimen(context, R.dimen.episode_drawer_detail_btn_pad_h),
                TvUi.dimen(context, R.dimen.episode_drawer_detail_btn_pad_v)
            )
            setOnClickListener { onDetailClick() }
            setOnFocusChangeListener { v, f ->
                v.scaleX = if (f) 1.05f else 1f
                v.scaleY = if (f) 1.05f else 1f
            }
        }
        topRow.addView(fullDetailBtn, LayoutParams(-2, TvUi.dimen(context, R.dimen.episode_drawer_detail_btn_height)))
        addView(topRow)

        // 2. Horizontal Scroll of Episode Pills
        scrollView = HorizontalScrollView(context).apply {
            isHorizontalScrollBarEnabled = false
            setPadding(0, TvUi.dimen(context, R.dimen.episode_drawer_tabs_pad_top), 0, 0)
        }
        episodeListRow = TvUi.row(context)
        scrollView.addView(episodeListRow)
        addView(scrollView, LayoutParams(-1, -2))
    }

    override fun requestChildFocus(child: View?, focused: View?) {
        val pendingIndex = pendingTabFocusIndex
        if (pendingIndex != null) {
            pendingTabFocusIndex = null
            val targetTab = groupTabsRow.getChildAt(pendingIndex)
            if (targetTab != null) {
                targetTab.requestFocus()
                return
            }
        }
        super.requestChildFocus(child, focused)
    }

    fun render(detail: Detail, currentEpisodeIndex: Int) {
        activeIndex = currentEpisodeIndex
        titleView.text = "选集 · 《${detail.series.title}》 (全${detail.episodes.size}集)"

        // Group tabs
        groupTabsRow.removeAllViews()
        val totalGroups = (detail.episodes.size + 49) / 50
        if (totalGroups > 1) {
            val groupMinHeight = TvUi.dimen(context, R.dimen.episode_group_btn_min_height)
            val groupHeight = TvUi.dimen(context, R.dimen.episode_group_btn_height)
            val groupPadH = TvUi.dimen(context, R.dimen.episode_group_btn_pad_h)
            val groupPadV = TvUi.dimen(context, R.dimen.episode_group_btn_pad_v)
            val groupMarginEnd = TvUi.dimen(context, R.dimen.episode_group_btn_margin_end)

            for (g in 0 until totalGroups) {
                val start = g * 50 + 1
                val end = minOf((g + 1) * 50, detail.episodes.size)
                val isCurrentGroup = g == drawerEpisodeGroup
                val groupBtn = Button(context).apply {
                    text = "$start—$end"
                    textSize = 12f
                    isAllCaps = false
                    setTextColor(if (isCurrentGroup) Color.WHITE else TvUi.TEXT_MUTED)
                    background = TvUi.pillBackground(active = isCurrentGroup, radius = 20f)
                    minHeight = groupMinHeight
                    setPadding(groupPadH, groupPadV, groupPadH, groupPadV)
                    setOnClickListener {
                        drawerEpisodeGroup = g
                        render(detail, activeIndex)
                        groupTabsRow.getChildAt(g)?.requestFocus()
                    }
                    setOnFocusChangeListener { v, f ->
                        v.scaleX = if (f) 1.06f else 1f
                        v.scaleY = if (f) 1.06f else 1f
                    }
                }
                groupTabsRow.addView(groupBtn, LayoutParams(-2, groupHeight).apply {
                    marginEnd = groupMarginEnd
                })
            }
        }

        // Episodes list
        episodeListRow.removeAllViews()
        drawerButtons.clear()
        val visible = detail.episodes.drop(drawerEpisodeGroup * 50).take(50)
        val itemMinHeight = TvUi.dimen(context, R.dimen.episode_item_btn_min_height)
        val itemHeight = TvUi.dimen(context, R.dimen.episode_item_btn_height)
        val itemPadH = TvUi.dimen(context, R.dimen.episode_item_btn_pad_h)
        val itemPadV = TvUi.dimen(context, R.dimen.episode_item_btn_pad_v)
        val itemMarginEnd = TvUi.dimen(context, R.dimen.episode_item_btn_margin_end)

        visible.forEachIndexed { offset, episode ->
            val index = drawerEpisodeGroup * 50 + offset
            val isCurrent = index == activeIndex
            val btn = Button(context).apply {
                id = View.generateViewId()
                text = "${episode.number}"
                textSize = 14f
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(if (isCurrent) Color.WHITE else 0xffcbd5e1.toInt())
                background = TvUi.pillBackground(active = isCurrent, radius = 12f)
                minHeight = itemMinHeight
                setPadding(itemPadH, itemPadV, itemPadH, itemPadV)
                setOnClickListener {
                    onEpisodeSelected(index)
                }
                setOnFocusChangeListener { v, f ->
                    v.scaleX = if (f) 1.08f else 1f
                    v.scaleY = if (f) 1.08f else 1f
                }
            }
            drawerButtons.add(btn)
            episodeListRow.addView(btn, LayoutParams(-2, itemHeight).apply {
                marginEnd = itemMarginEnd
            })
        }
    }
}
