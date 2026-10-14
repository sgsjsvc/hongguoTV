package com.hongguotv.tv.ui

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView
import com.hongguotv.tv.R
import com.hongguotv.tv.TvUi

internal class AppHeaderView(
    context: Context,
    private val onFeedClick: () -> Unit,
    private val onSearchClick: () -> Unit,
    private val onCategoryClick: () -> Unit,
    private val onRankClick: () -> Unit,
    private val onFavoritesClick: () -> Unit,
    private val onHistoryClick: () -> Unit,
    private val onSettingsClick: () -> Unit,
    private val onFocusChange: (View, Boolean) -> Unit
) : LinearLayout(context) {

    val topNavigationButtons = mutableListOf<Button>()
    private val topNavigation: HorizontalScrollView

    init {
        orientation = HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(
            TvUi.dimen(context, R.dimen.header_padding_h),
            TvUi.dimen(context, R.dimen.header_padding_v),
            TvUi.dimen(context, R.dimen.header_padding_h),
            TvUi.dimen(context, R.dimen.header_padding_v)
        )

        // Brand Logo Block
        val brandBox = LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val logoIcon = TvUi.logoIcon(context)
        val brandLogoSize = TvUi.dimen(context, R.dimen.brand_logo_size)
        brandBox.addView(logoIcon, LayoutParams(brandLogoSize, brandLogoSize).apply {
            marginEnd = TvUi.dimen(context, R.dimen.nav_button_pad_h)
        })

        val brandTitle = TextView(context).apply {
            text = "红果短剧"
            textSize = 17f
            setTextColor(Color.WHITE)
            setTypeface(typeface, Typeface.BOLD)
        }
        brandBox.addView(brandTitle)
        addView(brandBox, LayoutParams(-2, -2).apply {
            marginEnd = TvUi.dimen(context, R.dimen.brand_margin_end)
        })

        // Center Nav Tabs
        topNavigation = HorizontalScrollView(context).apply {
            isHorizontalScrollBarEnabled = false
        }
        val navRow = TvUi.row(context)
        val destinations = listOf(
            "推荐" to onFeedClick,
            "搜索" to onSearchClick,
            "分类" to onCategoryClick,
            "榜单" to onRankClick,
            "追剧" to onFavoritesClick,
            "历史" to onHistoryClick
        )

        val navBtnMinHeight = TvUi.dimen(context, R.dimen.nav_button_min_height)
        val navBtnHeight = TvUi.dimen(context, R.dimen.nav_button_height)
        val navPadH = TvUi.dimen(context, R.dimen.nav_button_pad_h)
        val navPadV = TvUi.dimen(context, R.dimen.nav_button_pad_v)
        val navMarginEnd = TvUi.dimen(context, R.dimen.nav_button_margin_end)

        destinations.forEachIndexed { idx, (label, action) ->
            val isActive = (idx == 0)
            val button = Button(context).apply {
                id = View.generateViewId()
                text = label
                contentDescription = "导航：$label"
                textSize = 14f
                isAllCaps = false
                setTextColor(Color.WHITE)
                background = TvUi.pillBackground(active = isActive)
                minHeight = navBtnMinHeight
                setPadding(navPadH, navPadV, navPadH, navPadV)
                setOnClickListener { action() }
                setOnFocusChangeListener { view, focused ->
                    onFocusChange(view, focused)
                    view.scaleX = if (focused) 1.05f else 1f
                    view.scaleY = if (focused) 1.05f else 1f
                }
            }
            topNavigationButtons.add(button)
            navRow.addView(button, LayoutParams(-2, navBtnHeight).apply {
                marginEnd = navMarginEnd
            })
        }
        topNavigation.addView(navRow)
        addView(topNavigation, LayoutParams(0, -2, 1f))

        // Right Settings Button
        val settingsBtn = Button(context).apply {
            id = View.generateViewId()
            text = "设置"
            contentDescription = "导航：设置"
            textSize = 14f
            isAllCaps = false
            setTextColor(TvUi.TEXT_MUTED)
            background = TvUi.pillBackground(active = false)
            minHeight = navBtnMinHeight
            setPadding(navPadH, navPadV, navPadH, navPadV)
            setOnClickListener { onSettingsClick() }
            setOnFocusChangeListener { view, focused ->
                onFocusChange(view, focused)
                view.scaleX = if (focused) 1.05f else 1f
                view.scaleY = if (focused) 1.05f else 1f
            }
        }
        topNavigationButtons.add(settingsBtn)
        addView(settingsBtn, LayoutParams(-2, navBtnHeight))
    }
}
